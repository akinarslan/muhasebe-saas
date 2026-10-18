import {
  mkdir,
  lstat,
  realpath,
  readFile,
  writeFile,
  stat,
} from "node:fs/promises";
import { readSync } from "node:fs";
import { resolve, join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { BackupKey, validateKeyId, wrapKey, unwrapKey } from "./keys";
import { BackupError, requireCheck, canonical } from "./core";
import { restrict } from "./workspace";

async function vaultRoot(create = false) {
  const root = resolve(".data/backup-keys");
  if (create) await mkdir(root, { recursive: true, mode: 0o700 });
  requireCheck(
    !(await lstat(root)).isSymbolicLink() &&
      (await realpath(root)).toLowerCase() === root.toLowerCase(),
    "KEY_VAULT_PATH_REJECTED",
  );
  if (create) await restrict(root);
  return root;
}
export async function saveVaultKey(key: BackupKey, passphrase: Buffer) {
  const root = await vaultRoot(true);
  await writeFile(
    join(root, validateKeyId(key.keyId) + ".json"),
    canonical(wrapKey(key, passphrase)),
    { flag: "wx", mode: 0o600 },
  );
  return key.keyId;
}
export async function loadVaultKey(id: string, passphrase: Buffer) {
  validateKeyId(id);
  try {
    const root = await vaultRoot();
    const file = join(root, id + ".json");
    requireCheck(
      !(await lstat(file)).isSymbolicLink() && (await stat(file)).size <= 16384,
      "KEY_ENVELOPE_INVALID",
    );
    const key = unwrapKey(JSON.parse(await readFile(file, "utf8")), passphrase);
    if (key.keyId !== id) {
      key.dispose();
      throw new BackupError("KEY_ID_MISMATCH");
    }
    return key;
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError("BACKUP_KEY_NOT_FOUND_OR_UNREADABLE");
  }
}
// Secrets are read from an inherited pipe or a hidden TTY, never argv/env values.
export async function readPassphrase(
  prompt = "Vault passphrase: ",
): Promise<Buffer> {
  const fd = process.env.BACKUP_KEY_PASSPHRASE_FD;
  if (fd !== undefined) {
    requireCheck(/^(?:[3-9]|[1-9][0-9])$/.test(fd), "PASSPHRASE_FD_INVALID");
    const buf = Buffer.alloc(1025);
    let n = 0;
    try {
      while (n < buf.length) {
        const count = readSync(Number(fd), buf, n, buf.length - n, null);
        if (!count) break;
        n += count;
      }
      requireCheck(n >= 20 && n <= 1024, "VAULT_PASSPHRASE_INVALID");
      return Buffer.from(buf.subarray(0, n));
    } finally {
      buf.fill(0);
    }
  }
  requireCheck(
    process.stdin.isTTY && typeof process.stdin.setRawMode === "function",
    "PASSPHRASE_SECURE_INPUT_REQUIRED",
  );
  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((accept, reject) => {
    const bytes: number[] = [];
    const done = (error?: BackupError) => {
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("error", onEnd);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write("\n");
      const value = Buffer.from(bytes);
      bytes.fill(0);
      if (error) {
        value.fill(0);
        reject(error);
      } else if (value.length < 20) {
        value.fill(0);
        reject(new BackupError("VAULT_PASSPHRASE_INVALID"));
      } else accept(value);
    };
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3)
          return done(new BackupError("PASSPHRASE_INPUT_CANCELLED"));
        if (byte === 13 || byte === 10) return done();
        if (byte === 127 || byte === 8) bytes.pop();
        else bytes.push(byte);
        if (bytes.length > 1024)
          return done(new BackupError("VAULT_PASSPHRASE_INVALID"));
      }
    };
    const onEnd = () => done(new BackupError("PASSPHRASE_INPUT_CLOSED"));
    process.stdin.on("data", onData);
    process.stdin.once("end", onEnd);
    process.stdin.once("error", onEnd);
  });
}
export async function confirmPassphrase() {
  const a = await readPassphrase("New vault passphrase (hidden): ");
  try {
    const b = await readPassphrase("Repeat passphrase (hidden): ");
    try {
      requireCheck(
        a.length === b.length && timingSafeEqual(a, b),
        "PASSPHRASE_CONFIRMATION_FAILED",
      );
      return Buffer.from(a);
    } finally {
      b.fill(0);
    }
  } finally {
    a.fill(0);
  }
}
