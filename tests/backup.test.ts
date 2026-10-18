// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, createHash, createHmac, hkdfSync } from "node:crypto";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import {
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import {
  authenticateManifest,
  BackupError,
  canonical,
  keyFromEnv,
  newContext,
  readManifest,
  sealFile,
  verifyFile,
  type Manifest,
} from "../scripts/backup/core";
import {
  expectedTables,
  pgEnvironment,
  sourceTarget,
  toolMajor,
  validateRole,
  validateToc,
} from "../scripts/backup/postgres";
import { developmentTarget } from "../src/server/db/target";
import {
  R2Storage,
  r2Config,
  publicAccessReview,
} from "../scripts/backup/storage";
import {
  lock,
  restrict,
  scratch,
  removeScratch,
} from "../scripts/backup/workspace";
import { runTool } from "../scripts/backup/postgres";

const dirs: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true });
});
async function temp() {
  const dir = await mkdtemp(join(tmpdir(), "pusula-e2-fixture-"));
  dirs.push(dir);
  return dir;
}
async function fixture(
  sourceEnvironment: "development" | "fixture" = "fixture",
) {
  const dir = await temp(),
    key = randomBytes(32),
    input = join(dir, "fixture.dump"),
    output = join(dir, "archive.gcm");
  // Synthetic bytes, NOT a PostgreSQL archive or real DB evidence.
  const payload = Buffer.from(
    'PGDMP synthetic fixture: {"tenant":"imaginary","usd":"1.250000"}',
  );
  await writeFile(input, payload);
  const ctx = newContext({
    sourceEnvironment,
    databaseVersion: "18.6",
    schemaVersion: "a".repeat(64),
    coverageSha256: "b".repeat(64),
    keyId: "fixture-v1",
  });
  const manifest = await sealFile(input, output, ctx, key);
  return { dir, key, input, output, manifest, payload };
}
const url = (username = "pusula_backup") =>
  `postgresql://${username}:imaginary-password@${developmentTarget.host}/pusula_development?sslmode=verify-full`;
const role = {
  rolbypassrls: true,
  rolsuper: false,
  rolcreatedb: false,
  rolcreaterole: false,
  rolreplication: false,
  managed_admin: false,
};
const goodToc =
  expectedTables
    .map((t, i) => `${i + 1}; 0 1 TABLE DATA public ${t} fixture_owner`)
    .join("\n") +
  "\n99; 0 1 POLICY public x y\n100; 0 1 TRIGGER public CloudSaleLine d_seal_sale_line fixture_owner\n101; 0 1 FK CONSTRAINT public x y\n102; 0 1 INDEX public x y\n103; 0 1 TRIGGER public CloudPaymentPlan d_seal_payment_plan fixture_owner";

describe("source and coverage guards", () => {
  it("accepts only approved direct source with separate backup role", () => {
    expect(sourceTarget(url()).username).toBe("pusula_backup");
    for (const user of ["pusula_runtime", "pusula_auth", "neondb_owner"])
      expect(() => sourceTarget(url(user))).toThrow("SOURCE_TARGET_REJECTED");
  });
  it.each([
    url().replace("pusula_development", "production"),
    url().replace(developmentTarget.host, "attacker.example"),
    url().replace(".c-8.", "-pooler.c-8."),
    url().replace("verify-full", "require"),
    url() + "&options=evil",
    url().replace("postgresql:", "https:"),
  ])("rejects unsafe source", (value) =>
    expect(() => sourceTarget(value)).toThrow(),
  );
  it("allows only explicitly selected loopback fixture identity", () => {
    const local =
      "postgresql://pusula_fixture_backup:test@127.0.0.1:55432/pusula_backup_fixture?sslmode=disable";
    expect(sourceTarget(local, true).hostname).toBe("127.0.0.1");
    expect(() => sourceTarget(local)).toThrow();
    expect(() => sourceTarget(url(), true)).toThrow();
  });
  it("never passes R2/encryption/application secrets to pg tools", () => {
    const env = pgEnvironment(sourceTarget(url()));
    expect(env.PGSSLMODE).toBe("verify-full");
    expect(env.PGPASSWORD).toBe("imaginary-password");
    expect(env).not.toHaveProperty("R2_SECRET_ACCESS_KEY");
    expect(env).not.toHaveProperty("AUTH_SECRET");
    expect(env).not.toHaveProperty("BACKUP_ENCRYPTION_KEY");
  });
  it("requires PG18 rather than an older dump client", () => {
    expect(toolMajor("pg_dump (PostgreSQL) 18.6")).toBe(18);
    for (const v of ["17.9", "19.0", "bad"])
      expect(() => toolMajor("pg_dump (PostgreSQL) " + v)).toThrow(
        "PG18_TOOLS_REQUIRED",
      );
  });
  it("rejects RLS filtering, managed admin and escalation", () => {
    expect(() => validateRole(role)).not.toThrow();
    expect(() => validateRole({ ...role, rolbypassrls: false })).toThrow(
      "BACKUP_ROLE_REJECTED",
    );
    for (const k of [
      "rolsuper",
      "rolcreatedb",
      "rolcreaterole",
      "rolreplication",
      "managed_admin",
    ])
      expect(() => validateRole({ ...role, [k]: true })).toThrow();
  });
  it("compares exact table-data names including auth/history/migrations", () => {
    expect(() => validateToc(goodToc)).not.toThrow();
    expect(() =>
      validateToc(
        goodToc.replace(
          "TABLE DATA public AuthTwoFactor",
          "TABLE DATA public MissingFactor",
        ),
      ),
    ).toThrow("DUMP_TABLE_DATA_INCOMPLETE");
    expect(() =>
      validateToc(goodToc.replace(" POLICY public ", " OMITTED public ")),
    ).toThrow("DUMP_SCHEMA_INCOMPLETE");
  });
});

describe("authenticated streaming archive", () => {
  it("round trips synthetic bytes without emitting plaintext", async () => {
    const f = await fixture(),
      result = await verifyFile(f.output, f.manifest, f.key, "fixture-v1");
    expect(result.plaintextSize).toBe(f.payload.length);
    expect(result.plaintextSha256).toBe(
      createHash("sha256").update(f.payload).digest("hex"),
    );
    expect((await readFile(f.output)).includes(f.payload)).toBe(false);
    expect(canonical(f.manifest)).not.toContain("imaginary");
  });
  it("uses independent random salt/IV for repeated backup", async () => {
    const a = await fixture(),
      b = await fixture();
    expect(a.manifest.iv).not.toBe(b.manifest.iv);
    expect(a.manifest.salt).not.toBe(b.manifest.salt);
    expect(a.manifest.backupId).not.toBe(b.manifest.backupId);
  });
  it("requires canonical 32-byte base64 key", () => {
    const key = randomBytes(32);
    expect(keyFromEnv(key.toString("base64"))).toEqual(key);
    for (const bad of [
      undefined,
      "password",
      randomBytes(16).toString("base64"),
    ])
      expect(() => keyFromEnv(bad)).toThrow("KEY_FORMAT_INVALID");
  });
  it("rejects wrong key and wrong key ID", async () => {
    const f = await fixture();
    await expect(
      verifyFile(f.output, f.manifest, randomBytes(32), "fixture-v1"),
    ).rejects.toThrow("MANIFEST_AUTH_FAILED");
    await expect(
      verifyFile(f.output, f.manifest, f.key, "other-v1"),
    ).rejects.toThrow("KEY_ID_MISMATCH");
  });
  it("checks GCM authentication even with a validly MACed manifest and matching ciphertext hash", async () => {
    const f = await fixture();
    const bytes = await readFile(f.output);
    bytes[0] ^= 1;
    await writeFile(f.output, bytes);
    const { mac: previousMac, ...unsigned } = {
      ...f.manifest,
      ciphertextSha256: createHash("sha256").update(bytes).digest("hex"),
    };
    expect(previousMac).toHaveLength(64);
    const signingKey = Buffer.from(
      hkdfSync(
        "sha256",
        f.key,
        Buffer.from(unsigned.salt, "hex"),
        "pusula-backup-v1/manifest",
        32,
      ),
    );
    const m = {
      ...unsigned,
      mac: createHmac("sha256", signingKey)
        .update(canonical(unsigned))
        .digest("hex"),
    };
    await expect(verifyFile(f.output, m, f.key, "fixture-v1")).rejects.toThrow(
      "DECRYPT_AUTH_FAILED",
    );
  });
  it("rejects corruption and truncation", async () => {
    const f = await fixture(),
      data = await readFile(f.output);
    data[0] ^= 1;
    await writeFile(f.output, data);
    await expect(
      verifyFile(f.output, f.manifest, f.key, "fixture-v1"),
    ).rejects.toThrow("CIPHERTEXT_MISMATCH");
    await writeFile(f.output, data.subarray(0, 3));
    await expect(
      verifyFile(f.output, f.manifest, f.key, "fixture-v1"),
    ).rejects.toThrow();
  });
  it.each([
    "createdAt",
    "objectKey",
    "ciphertextSha256",
    "authTag",
    "coverageSha256",
    "status",
  ])("rejects modified manifest field %s", async (field) => {
    const f = await fixture();
    expect(() =>
      authenticateManifest(
        { ...f.manifest, [field]: "tampered" },
        f.key,
        "fixture-v1",
      ),
    ).toThrow();
  });
  it("rejects swapped archive/manifest and unknown fields", async () => {
    const a = await fixture(),
      b = await fixture();
    await expect(
      verifyFile(b.output, a.manifest, a.key, "fixture-v1"),
    ).rejects.toThrow();
    expect(() =>
      authenticateManifest(
        { ...a.manifest, ignored: true },
        a.key,
        "fixture-v1",
      ),
    ).toThrow("MANIFEST_INVALID");
  });
  it("fails on missing or oversized manifest", async () => {
    const dir = await temp();
    await expect(readManifest(join(dir, "missing"))).rejects.toThrow(
      "MANIFEST_MISSING_OR_INVALID",
    );
    await writeFile(join(dir, "big"), "x".repeat(20000));
    await expect(readManifest(join(dir, "big"))).rejects.toThrow();
  });
  it("never overwrites an existing local ciphertext", async () => {
    const f = await fixture();
    const before = await readFile(f.output);
    await expect(
      sealFile(f.input, f.output, newContext({ ...f.manifest }), f.key),
    ).rejects.toThrow();
    expect(await readFile(f.output)).toEqual(before);
  });
  it("streams 32MiB with bounded chunks", async () => {
    const dir = await temp(),
      input = join(dir, "large.dump"),
      output = join(dir, "large.gcm"),
      key = randomBytes(32);
    async function* chunks() {
      for (let i = 0; i < 512; i++) yield Buffer.alloc(65536, i % 256);
    }
    await pipeline(Readable.from(chunks()), createWriteStream(input));
    const baseline = process.memoryUsage().rss;
    let peak = baseline;
    const sampler = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().rss);
    }, 5);
    try {
      const m = await sealFile(
        input,
        output,
        newContext({
          sourceEnvironment: "fixture",
          databaseVersion: "18.6",
          schemaVersion: "a".repeat(64),
          coverageSha256: "b".repeat(64),
          keyId: "fixture-v1",
        }),
        key,
      );
      expect(
        (await verifyFile(output, m, key, "fixture-v1")).plaintextSize,
      ).toBe(32 * 1024 ** 2);
      expect((await stat(output)).size).toBe(m.ciphertextSize);
      expect(peak - baseline).toBeLessThan(96 * 1024 ** 2);
    } finally {
      clearInterval(sampler);
    }
  });
});

describe("operator workspace and process failures", () => {
  it("restricts ACL, cleans only its scratch directory and retains unrelated files", async () => {
    const root = await temp();
    await restrict(root);
    await writeFile(join(root, "keep.txt"), "synthetic keep");
    const dir = await scratch(root);
    await writeFile(join(dir, "source.dump"), "synthetic plaintext");
    await removeScratch(root, dir);
    expect(await readFile(join(root, "keep.txt"), "utf8")).toBe(
      "synthetic keep",
    );
    await expect(stat(dir)).rejects.toThrow();
  });
  it("refuses cleanup of the backup root itself", async () => {
    const root = await temp();
    await expect(removeScratch(root, root)).rejects.toThrow(
      "UNSAFE_CLEANUP_TARGET",
    );
    expect((await stat(root)).isDirectory()).toBe(true);
  });
  it("excludes parallel jobs and releases lock for retry", async () => {
    const root = await temp(),
      release = await lock(root);
    await expect(lock(root)).rejects.toThrow();
    await release();
    const retry = await lock(root);
    await retry();
  });
  it("discards sensitive child stderr and returns only a safe code", async () => {
    await expect(
      runTool(process.execPath, [
        "-e",
        "console.error('synthetic-credential-never-forward');process.exit(1)",
      ]),
    ).rejects.toEqual(new BackupError("TOOL_FAILED"));
  });
  it("classifies missing executable safely", async () => {
    await expect(
      runTool(join(await temp(), "missing-tool"), []),
    ).rejects.toEqual(new BackupError("TOOL_UNAVAILABLE"));
  });
  it("waits for timed-out child termination before returning failure", async () => {
    await expect(
      runTool(
        process.execPath,
        ["-e", "setInterval(()=>{},1000)"],
        process.env,
        30,
      ),
    ).rejects.toEqual(new BackupError("TOOL_TIMEOUT"));
  });
});

function fakeStore(
  options: { failPut?: boolean; corrupt?: boolean; failGet?: boolean } = {},
) {
  const objects = new Map<
    string,
    { body: Buffer; metadata?: Record<string, string> }
  >();
  const statusError = (httpStatusCode: number) =>
    Object.assign(new Error("secret-must-not-be-logged"), {
      $metadata: { httpStatusCode },
    });
  const send = vi.fn(async (cmd: unknown) => {
    if (cmd instanceof HeadBucketCommand) return {};
    if (cmd instanceof PutObjectCommand) {
      if (options.failPut) throw statusError(403);
      const k = cmd.input.Key!;
      if (objects.has(k)) throw statusError(412);
      expect(cmd.input.IfNoneMatch).toBe("*");
      expect(cmd.input.StorageClass).toBe("STANDARD");
      const body = cmd.input.Body;
      const chunks: Buffer[] = [];
      if (typeof body === "string") chunks.push(Buffer.from(body));
      else
        for await (const chunk of body as AsyncIterable<Buffer>)
          chunks.push(Buffer.from(chunk));
      objects.set(k, {
        body: Buffer.concat(chunks),
        metadata: cmd.input.Metadata,
      });
      return {};
    }
    if (cmd instanceof HeadObjectCommand) {
      const o = objects.get(cmd.input.Key!);
      if (!o) throw statusError(404);
      return { ContentLength: o.body.length, Metadata: o.metadata };
    }
    if (cmd instanceof GetObjectCommand) {
      if (options.failGet) throw statusError(503);
      const o = objects.get(cmd.input.Key!);
      if (!o) throw statusError(404);
      const bytes = Buffer.from(o.body);
      if (options.corrupt) bytes[0] ^= 1;
      return { ContentLength: bytes.length, Body: Readable.from([bytes]) };
    }
    if (cmd instanceof ListObjectsV2Command)
      return {
        Contents: [...objects.keys()].map((Key) => ({ Key })),
        IsTruncated: false,
      };
    throw new Error("unexpected-command");
  });
  return {
    objects,
    send,
    store: new R2Storage({ send } as unknown as ConstructorParameters<
      typeof R2Storage
    >[0]),
  };
}
describe("R2 adapter with in-memory S3 fixture (no cloud writes)", () => {
  it("distinguishes operator attestation from independent public access verification", () => {
    expect(publicAccessReview("not-verified", true)).toBe(
      "operator-attested-disabled",
    );
    expect(publicAccessReview("managed-and-custom-disabled", false)).toBe(
      "managed-and-custom-disabled",
    );
    expect(() => publicAccessReview("not-verified", false)).toThrow(
      "R2_SECURITY_REVIEW_REQUIRED",
    );
    expect(() => publicAccessReview("enabled", true)).toThrow(
      "R2_SECURITY_STATUS_INVALID",
    );
  });
  it("rejects hostile endpoints and wrong bucket", () => {
    const env = {
      R2_ACCOUNT_ID: "a".repeat(32),
      R2_ENDPOINT: `https://${"a".repeat(32)}.r2.cloudflarestorage.com`,
      R2_BUCKET: "pusula-backups-development",
      R2_ACCESS_KEY_ID: "fixture",
      R2_SECRET_ACCESS_KEY: "fixture",
    };
    expect(r2Config(env)).toMatchObject({ region: "auto", maxAttempts: 1 });
    expect(() =>
      r2Config({ ...env, R2_ENDPOINT: "https://attacker.example" }),
    ).toThrow();
    expect(() => r2Config({ ...env, R2_BUCKET: "production" })).toThrow();
  });
  it("refuses to upload fixture-labelled bytes", async () => {
    const f = await fixture(),
      r2 = fakeStore();
    await expect(
      r2.store.upload(f.output, f.manifest, f.key, "fixture-v1", await temp()),
    ).rejects.toThrow("FIXTURE_UPLOAD_FORBIDDEN");
    expect(r2.send).not.toHaveBeenCalled();
  });
  it("conditionally uploads ciphertext then verifies downloaded archive and signed manifest", async () => {
    const f = await fixture("development"),
      r2 = fakeStore();
    expect(
      (
        await r2.store.upload(
          f.output,
          f.manifest,
          f.key,
          "fixture-v1",
          await temp(),
        )
      ).status,
    ).toBe("remote-verified");
    expect(r2.objects.size).toBe(2);
    expect(await r2.store.list()).toEqual([
      f.manifest.objectKey.replace("archive.gcm", "manifest.json"),
    ]);
    for (const o of r2.objects.values())
      expect(o.body.includes(f.payload)).toBe(false);
  });
  it("retries the same ID without replacing either object", async () => {
    const f = await fixture("development"),
      r2 = fakeStore();
    await r2.store.upload(
      f.output,
      f.manifest,
      f.key,
      "fixture-v1",
      await temp(),
    );
    const before = new Map(r2.objects);
    await r2.store.upload(
      f.output,
      f.manifest,
      f.key,
      "fixture-v1",
      await temp(),
    );
    expect(r2.objects).toEqual(before);
    expect(r2.objects.size).toBe(2);
  });
  it("classifies access denial without including provider error text", async () => {
    const f = await fixture("development"),
      r2 = fakeStore({ failPut: true });
    await expect(
      r2.store.upload(f.output, f.manifest, f.key, "fixture-v1", await temp()),
    ).rejects.toEqual(new BackupError("R2_UPLOAD_FAILED"));
    expect(r2.objects.size).toBe(0);
  });
  it("does not commit manifest after corrupted readback", async () => {
    const f = await fixture("development"),
      r2 = fakeStore({ corrupt: true });
    await expect(
      r2.store.upload(f.output, f.manifest, f.key, "fixture-v1", await temp()),
    ).rejects.toThrow("CIPHERTEXT_MISMATCH");
    expect(r2.objects.size).toBe(1);
  });
  it("does not report success after a readback connection failure", async () => {
    const f = await fixture("development"),
      r2 = fakeStore({ failGet: true });
    await expect(
      r2.store.upload(f.output, f.manifest, f.key, "fixture-v1", await temp()),
    ).rejects.toThrow();
    expect(r2.objects.size).toBe(1);
  });
  it("rejects a conflicting preexisting archive rather than overwriting it", async () => {
    const f = await fixture("development"),
      r2 = fakeStore();
    r2.objects.set(f.manifest.objectKey, { body: Buffer.from("conflict") });
    await expect(
      r2.store.upload(f.output, f.manifest, f.key, "fixture-v1", await temp()),
    ).rejects.toThrow("R2_METADATA_MISMATCH");
    expect(r2.objects.size).toBe(1);
  });
  it("missing remote object fails verification", async () => {
    const f = await fixture("development"),
      r2 = fakeStore();
    await expect(
      r2.store.downloadVerify(
        f.manifest as Manifest,
        await temp(),
        f.key,
        "fixture-v1",
      ),
    ).rejects.toThrow("R2_METADATA_MISMATCH");
  });
});
