import {
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { inspect } from "node:util";
import { z } from "zod";
import { BackupError, requireCheck, keyFromEnv, canonical } from "./core";

export function validateKeyId(id: string) {
  requireCheck(/^[A-Za-z0-9_-]{1,64}$/.test(id), "KEY_ID_INVALID");
  return id;
}
export class BackupKey {
  #secret: Buffer;
  #disposed = false;
  constructor(
    readonly keyId: string,
    secret: Buffer,
  ) {
    validateKeyId(keyId);
    requireCheck(secret.length === 32, "KEY_FORMAT_INVALID");
    this.#secret = Buffer.from(secret);
  }
  static generate() {
    const bytes = randomBytes(32);
    try {
      return new BackupKey("key-" + randomUUID(), bytes);
    } finally {
      bytes.fill(0);
    }
  }
  static fromBase64(id: string, value: string) {
    const bytes = keyFromEnv(value);
    try {
      return new BackupKey(id, bytes);
    } finally {
      bytes.fill(0);
    }
  }
  use<T>(fn: (key: Buffer) => T): T {
    requireCheck(!this.#disposed, "KEY_DISPOSED");
    return fn(this.#secret);
  }
  dispose() {
    this.#secret.fill(0);
    this.#disposed = true;
  }
  toJSON() {
    return { keyId: this.keyId, secret: "[REDACTED]" };
  }
  [inspect.custom]() {
    return this.toJSON();
  }
}
export class KeyRing {
  #keys = new Map<string, BackupKey>();
  #active: string | undefined;
  add(key: BackupKey, activate = false) {
    requireCheck(!this.#keys.has(key.keyId), "KEY_ID_ALREADY_EXISTS");
    this.#keys.set(key.keyId, key);
    if (activate) this.#active = key.keyId;
  }
  active() {
    requireCheck(this.#active, "ACTIVE_KEY_MISSING");
    return this.get(this.#active);
  }
  get(id: string) {
    validateKeyId(id);
    const key = this.#keys.get(id);
    requireCheck(key, "BACKUP_KEY_NOT_FOUND");
    return key;
  }
  rotate() {
    const key = BackupKey.generate();
    this.add(key, true);
    return key.keyId;
  }
  dispose() {
    for (const key of this.#keys.values()) key.dispose();
    this.#keys.clear();
    this.#active = undefined;
  }
  toJSON() {
    return { activeKeyId: this.#active, keyIds: [...this.#keys.keys()] };
  }
  [inspect.custom]() {
    return this.toJSON();
  }
}
const vaultSchema = z
  .object({
    format: z.literal("pusula-key-vault-v1"),
    keyId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    kdf: z.literal("scrypt-N32768-r8-p1"),
    salt: z.string().regex(/^[a-f0-9]{64}$/),
    iv: z.string().regex(/^[a-f0-9]{24}$/),
    tag: z.string().regex(/^[a-f0-9]{32}$/),
    ciphertext: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type KeyEnvelope = z.infer<typeof vaultSchema>;
function wrappingKey(passphrase: Buffer, salt: string) {
  requireCheck(
    passphrase.length >= 20 && passphrase.length <= 1024,
    "VAULT_PASSPHRASE_INVALID",
  );
  return scryptSync(passphrase, Buffer.from(salt, "hex"), 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 ** 2,
  });
}
export function wrapKey(key: BackupKey, passphrase: Buffer): KeyEnvelope {
  const header = {
    format: "pusula-key-vault-v1" as const,
    keyId: key.keyId,
    kdf: "scrypt-N32768-r8-p1" as const,
    salt: randomBytes(32).toString("hex"),
    iv: randomBytes(12).toString("hex"),
  };
  const derived = wrappingKey(passphrase, header.salt);
  try {
    const cipher = createCipheriv(
      "aes-256-gcm",
      derived,
      Buffer.from(header.iv, "hex"),
    );
    cipher.setAAD(Buffer.from(canonical(header)));
    const encrypted = key.use((k) =>
      Buffer.concat([cipher.update(k), cipher.final()]),
    );
    return {
      ...header,
      tag: cipher.getAuthTag().toString("hex"),
      ciphertext: encrypted.toString("hex"),
    };
  } finally {
    derived.fill(0);
  }
}
export function unwrapKey(value: unknown, passphrase: Buffer): BackupKey {
  const parsed = vaultSchema.safeParse(value);
  requireCheck(parsed.success, "KEY_ENVELOPE_INVALID");
  const { tag, ciphertext, ...header } = parsed.data;
  const derived = wrappingKey(passphrase, header.salt);
  let plain: Buffer | undefined;
  let partial: Buffer | undefined, tail: Buffer | undefined;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      derived,
      Buffer.from(header.iv, "hex"),
    );
    decipher.setAAD(Buffer.from(canonical(header)));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    partial = decipher.update(Buffer.from(ciphertext, "hex"));
    tail = decipher.final();
    plain = Buffer.concat([partial, tail]);
    return new BackupKey(header.keyId, plain);
  } catch {
    throw new BackupError("KEY_UNWRAP_FAILED");
  } finally {
    plain?.fill(0);
    partial?.fill(0);
    tail?.fill(0);
    derived.fill(0);
  }
}
export function verifyRecoveryCopies(
  a: unknown,
  passA: Buffer,
  b: unknown,
  passB: Buffer,
) {
  const first = unwrapKey(a, passA);
  let second: BackupKey | undefined;
  try {
    second = unwrapKey(b, passB);
    requireCheck(
      first.keyId === second.keyId &&
        first.use((k) => second!.use((other) => timingSafeEqual(k, other))),
      "RECOVERY_COPY_MISMATCH",
    );
    return {
      keyId: first.keyId,
      readableCopies: 2,
      physicalSeparationVerified: false,
    };
  } finally {
    first.dispose();
    second?.dispose();
  }
}
