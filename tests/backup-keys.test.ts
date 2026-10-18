// @vitest-environment node
import { describe, it, expect } from "vitest";
import { inspect } from "node:util";
import { randomBytes } from "node:crypto";
import {
  BackupKey,
  KeyRing,
  wrapKey,
  unwrapKey,
  validateKeyId,
  verifyRecoveryCopies,
} from "../scripts/backup/keys";
import { newContext, sealFile, verifyFile } from "../scripts/backup/core";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
describe("backup key lifecycle with RAM-only test secrets", () => {
  it("checks two independently wrapped recovery copies without exposing material", () => {
    const key = BackupKey.generate(),
      a = randomBytes(32),
      b = randomBytes(32);
    try {
      expect(
        verifyRecoveryCopies(wrapKey(key, a), a, wrapKey(key, b), b),
      ).toEqual({
        keyId: key.keyId,
        readableCopies: 2,
        physicalSeparationVerified: false,
      });
    } finally {
      key.dispose();
      a.fill(0);
      b.fill(0);
    }
  });
  it("does not accept mismatched keys as two recovery copies", () => {
    const a = BackupKey.generate(),
      b = BackupKey.generate(),
      pass = randomBytes(32);
    try {
      expect(() =>
        verifyRecoveryCopies(wrapKey(a, pass), pass, wrapKey(b, pass), pass),
      ).toThrow("RECOVERY_COPY_MISMATCH");
    } finally {
      a.dispose();
      b.dispose();
      pass.fill(0);
    }
  });
  it("generates unique 256-bit keys with redacted JSON and inspection", () => {
    const a = BackupKey.generate(),
      b = BackupKey.generate();
    try {
      expect(a.keyId).not.toBe(b.keyId);
      a.use((k) => {
        expect(k.length).toBe(32);
        expect(k.equals(Buffer.alloc(32))).toBe(false);
        for (const text of [JSON.stringify(a), inspect(a)]) {
          expect(text.includes(k.toString("hex"))).toBe(false);
          expect(text.includes(k.toString("base64"))).toBe(false);
          expect(text).toContain("REDACTED");
        }
      });
    } finally {
      a.dispose();
      b.dispose();
    }
  });
  it.each(["../key", "a/b", "", "a".repeat(65), "bad.key"])(
    "rejects invalid key ID %s",
    (id) => expect(() => validateKeyId(id)).toThrow("KEY_ID_INVALID"),
  );
  it.each([
    "",
    "a".repeat(32),
    "a".repeat(64),
    Buffer.alloc(31).toString("base64"),
    Buffer.alloc(33).toString("base64"),
  ])("rejects invalid encoded key format", (value) =>
    expect(() => BackupKey.fromBase64("id", value)).toThrow(
      "KEY_FORMAT_INVALID",
    ),
  );
  it("imports canonical base64 and zeros disposed internal memory", () => {
    const bytes = randomBytes(32),
      key = BackupKey.fromBase64("legacy", bytes.toString("base64"));
    let ref: Buffer | undefined;
    key.use((k) => {
      expect(k.equals(bytes)).toBe(true);
      ref = k;
    });
    key.dispose();
    expect(ref!.equals(Buffer.alloc(32))).toBe(true);
    expect(() => key.use(() => {})).toThrow("KEY_DISPOSED");
    bytes.fill(0);
  });
  it("rotation keeps old IDs, rejects duplicates and missing IDs", () => {
    const ring = new KeyRing();
    try {
      expect(() => ring.active()).toThrow("ACTIVE_KEY_MISSING");
      const a = ring.rotate(),
        b = ring.rotate();
      expect(a).not.toBe(b);
      expect(ring.get(a).keyId).toBe(a);
      expect(ring.active().keyId).toBe(b);
      expect(() => ring.add(ring.get(a))).toThrow("KEY_ID_ALREADY_EXISTS");
      expect(() => ring.get("missing")).toThrow("BACKUP_KEY_NOT_FOUND");
    } finally {
      ring.dispose();
    }
  });
  it("portable envelope recovery matches the original key and never serializes plaintext", () => {
    const a = BackupKey.generate(),
      pass = randomBytes(32);
    try {
      const envelope = wrapKey(a, pass);
      const restored = unwrapKey(structuredClone(envelope), pass);
      try {
        a.use((k) => {
          expect(restored.use((r) => r.equals(k))).toBe(true);
          expect(JSON.stringify(envelope).includes(k.toString("base64"))).toBe(
            false,
          );
          expect(JSON.stringify(envelope).includes(k.toString("hex"))).toBe(
            false,
          );
        });
      } finally {
        restored.dispose();
      }
    } finally {
      a.dispose();
      pass.fill(0);
    }
  });
  it.each([
    "wrong-passphrase",
    "ciphertext",
    "keyId",
    "missing-tag",
    "extra-field",
  ])("rejects %s during key recovery", (kind) => {
    const a = BackupKey.generate(),
      pass = randomBytes(32);
    try {
      const original = wrapKey(a, pass);
      const value: Record<string, unknown> = { ...original };
      if (kind === "ciphertext") value.ciphertext = "0".repeat(64);
      if (kind === "keyId") value.keyId = "other-key";
      if (kind === "missing-tag") delete value.tag;
      if (kind === "extra-field") value.secret = "forbidden";
      expect(() =>
        unwrapKey(
          value,
          kind === "wrong-passphrase" ? Buffer.alloc(32, 3) : pass,
        ),
      ).toThrow();
    } finally {
      a.dispose();
      pass.fill(0);
    }
  });
  it("refuses weak-length passphrases before wrapping", () => {
    const a = BackupKey.generate();
    try {
      expect(() => wrapKey(a, Buffer.alloc(19))).toThrow(
        "VAULT_PASSPHRASE_INVALID",
      );
    } finally {
      a.dispose();
    }
  });
  it("old and rotated archives remain readable only with their recorded key IDs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pusula-key-"));
    const ring = new KeyRing();
    try {
      const input = join(dir, "plain");
      await writeFile(input, "imaginary fixture");
      const old = ring.rotate();
      const seal = async (id: string, out: string) =>
        ring.get(id).use((k) =>
          sealFile(
            input,
            join(dir, out),
            newContext({
              sourceEnvironment: "fixture",
              databaseVersion: "18.6",
              schemaVersion: "a".repeat(64),
              coverageSha256: "b".repeat(64),
              keyId: id,
            }),
            k,
          ),
        );
      const a = await seal(old, "old");
      const fresh = ring.rotate();
      const b = await seal(fresh, "new");
      await expect(
        ring.get(old).use((k) => verifyFile(join(dir, "old"), a, k, old)),
      ).resolves.toHaveProperty("plaintextSize", 17);
      await expect(
        ring.get(fresh).use((k) => verifyFile(join(dir, "new"), b, k, fresh)),
      ).resolves.toHaveProperty("plaintextSize", 17);
      await expect(
        ring.get(fresh).use((k) => verifyFile(join(dir, "old"), a, k, old)),
      ).rejects.toThrow("MANIFEST_AUTH_FAILED");
    } finally {
      ring.dispose();
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("generation CLI without explicit approval emits no key and exits blocked", async () => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/backup/key-cli.ts"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          NODE_ENV: "test",
          SystemRoot: process.env.SystemRoot,
          PATH: process.env.PATH,
          TEMP: process.env.TEMP,
        },
        windowsHide: true,
      },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.stderr.on("data", (b) => (err += b.toString()));
    const code = await new Promise<number | null>((done, reject) => {
      child.once("error", reject);
      child.once("close", done);
    });
    expect(code).toBe(1);
    expect(JSON.parse(out)).toEqual({
      status: "blocked",
      code: "KEY_GENERATION_APPROVAL_REQUIRED",
    });
    expect(err).toBe("");
  });
});
