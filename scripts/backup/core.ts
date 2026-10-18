import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { stat, readFile, writeFile } from "node:fs/promises";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";

export class BackupError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function requireCheck(ok: unknown, code: string): asserts ok {
  if (!ok) throw new BackupError(code);
}
export const MAX_BYTES = 4 * 1024 ** 3; // Below GCM per-message bound and S3 single PUT limit.
export const manifestSchema = z
  .object({
    backupId: z.uuid(),
    createdAt: z.iso.datetime(),
    sourceEnvironment: z.enum(["development", "fixture"]),
    databaseVersion: z.string().regex(/^18\.\d+$/),
    schemaVersion: z.string().regex(/^[a-f0-9]{64}$/),
    coverageSha256: z.string().regex(/^[a-f0-9]{64}$/),
    formatVersion: z.literal(1),
    encryptionAlgorithm: z.literal("AES-256-GCM"),
    keyId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    salt: z.string().regex(/^[a-f0-9]{64}$/),
    iv: z.string().regex(/^[a-f0-9]{24}$/),
    authTag: z.string().regex(/^[a-f0-9]{32}$/),
    ciphertextSize: z.number().int().positive().max(MAX_BYTES),
    ciphertextSha256: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.literal("encrypted-verified"),
    objectKey: z.string(),
    mac: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type Manifest = z.infer<typeof manifestSchema>;
export type Context = Pick<
  Manifest,
  | "backupId"
  | "createdAt"
  | "sourceEnvironment"
  | "databaseVersion"
  | "schemaVersion"
  | "coverageSha256"
  | "formatVersion"
  | "encryptionAlgorithm"
  | "keyId"
  | "salt"
  | "iv"
  | "objectKey"
>;
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function keyFromEnv(value: string | undefined): Buffer {
  requireCheck(
    value && /^[A-Za-z0-9+/]{43}=$/.test(value),
    "KEY_FORMAT_INVALID",
  );
  const key = Buffer.from(value, "base64");
  requireCheck(
    key.length === 32 && key.toString("base64") === value,
    "KEY_FORMAT_INVALID",
  );
  return key;
}
function derive(key: Buffer, salt: string, purpose: string) {
  requireCheck(key.length === 32, "KEY_FORMAT_INVALID");
  return Buffer.from(
    hkdfSync(
      "sha256",
      key,
      Buffer.from(salt, "hex"),
      `pusula-backup-v1/${purpose}`,
      32,
    ),
  );
}
function context(m: Manifest): Context {
  const {
    backupId,
    createdAt,
    sourceEnvironment,
    databaseVersion,
    schemaVersion,
    coverageSha256,
    formatVersion,
    encryptionAlgorithm,
    keyId,
    salt,
    iv,
    objectKey,
  } = m;
  return {
    backupId,
    createdAt,
    sourceEnvironment,
    databaseVersion,
    schemaVersion,
    coverageSha256,
    formatVersion,
    encryptionAlgorithm,
    keyId,
    salt,
    iv,
    objectKey,
  };
}
export function newContext(
  input: Pick<
    Context,
    | "sourceEnvironment"
    | "databaseVersion"
    | "schemaVersion"
    | "coverageSha256"
    | "keyId"
  >,
): Context {
  const backupId = randomUUID();
  return {
    ...input,
    backupId,
    createdAt: new Date().toISOString(),
    formatVersion: 1,
    encryptionAlgorithm: "AES-256-GCM",
    salt: randomBytes(32).toString("hex"),
    iv: randomBytes(12).toString("hex"),
    objectKey: `development/v1/${backupId}/archive.gcm`,
  };
}
export function authenticateManifest(
  value: unknown,
  key: Buffer,
  keyId: string,
): Manifest {
  const parsed = manifestSchema.safeParse(value);
  requireCheck(parsed.success, "MANIFEST_INVALID");
  const m = parsed.data;
  requireCheck(m.keyId === keyId, "KEY_ID_MISMATCH");
  requireCheck(
    m.objectKey === `development/v1/${m.backupId}/archive.gcm`,
    "MANIFEST_INVALID",
  );
  const { mac, ...unsigned } = m;
  const expected = createHmac("sha256", derive(key, m.salt, "manifest"))
    .update(canonical(unsigned))
    .digest();
  requireCheck(
    timingSafeEqual(expected, Buffer.from(mac, "hex")),
    "MANIFEST_AUTH_FAILED",
  );
  return m;
}
export async function digestFile(path: string) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    size += chunk.length;
    requireCheck(size <= MAX_BYTES, "ARCHIVE_TOO_LARGE");
    hash.update(chunk);
  }
  return { size, sha256: hash.digest("hex") };
}
export async function sealFile(
  input: string,
  output: string,
  ctx: Context,
  key: Buffer,
): Promise<Manifest> {
  const size = (await stat(input)).size;
  requireCheck(size > 0 && size <= MAX_BYTES, "ARCHIVE_SIZE_INVALID");
  const cipher = createCipheriv(
    "aes-256-gcm",
    derive(key, ctx.salt, "encryption"),
    Buffer.from(ctx.iv, "hex"),
  );
  cipher.setAAD(Buffer.from(canonical(ctx)));
  let bytes = 0;
  await pipeline(
    createReadStream(input),
    new Transform({
      transform(chunk, _, cb) {
        bytes += chunk.length;
        cb(
          bytes > MAX_BYTES ? new BackupError("ARCHIVE_TOO_LARGE") : null,
          chunk,
        );
      },
    }),
    cipher,
    createWriteStream(output, { flags: "wx", mode: 0o600 }),
  );
  const digest = await digestFile(output);
  const unsigned = {
    ...ctx,
    authTag: cipher.getAuthTag().toString("hex"),
    ciphertextSize: digest.size,
    ciphertextSha256: digest.sha256,
    status: "encrypted-verified" as const,
  };
  const m = {
    ...unsigned,
    mac: createHmac("sha256", derive(key, ctx.salt, "manifest"))
      .update(canonical(unsigned))
      .digest("hex"),
  };
  authenticateManifest(m, key, ctx.keyId);
  await verifyFile(output, m, key, ctx.keyId);
  return m;
}
// Verification drains plaintext into a private sink; never writes unauthenticated plaintext.
export async function verifyFile(
  path: string,
  value: unknown,
  key: Buffer,
  keyId: string,
) {
  const m = authenticateManifest(value, key, keyId);
  const digest = await digestFile(path);
  requireCheck(
    digest.size === m.ciphertextSize && digest.sha256 === m.ciphertextSha256,
    "CIPHERTEXT_MISMATCH",
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    derive(key, m.salt, "encryption"),
    Buffer.from(m.iv, "hex"),
  );
  decipher.setAAD(Buffer.from(canonical(context(m))));
  decipher.setAuthTag(Buffer.from(m.authTag, "hex"));
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    await pipeline(
      createReadStream(path),
      decipher,
      new Writable({
        write(chunk, _, cb) {
          bytes += chunk.length;
          hash.update(chunk);
          cb();
        },
      }),
    );
  } catch {
    throw new BackupError("DECRYPT_AUTH_FAILED");
  }
  return {
    manifest: m,
    plaintextSha256: hash.digest("hex"),
    plaintextSize: bytes,
  };
}
export async function readManifest(path: string) {
  try {
    requireCheck((await stat(path)).size <= 16384, "MANIFEST_INVALID");
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    throw new BackupError("MANIFEST_MISSING_OR_INVALID");
  }
}
export async function saveManifest(path: string, m: Manifest) {
  await writeFile(path, canonical(m), { flag: "wx", mode: 0o600 });
}
