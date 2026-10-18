// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { BackupKey } from "../scripts/backup/keys";
import {
  saveVaultKey,
  loadVaultKey,
  readPassphrase,
} from "../scripts/backup/key-vault";
const memory = vi.hoisted(() => ({
  files: new Map<string, string>(),
  symlink: false,
  restricted: vi.fn(),
  writes: vi.fn(),
  input: Buffer.alloc(0),
  offset: 0,
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  readSync: vi.fn(
    (_fd: number, target: Buffer, offset: number, length: number) => {
      const n = Math.min(length, memory.input.length - memory.offset);
      if (n > 0)
        memory.input.copy(target, offset, memory.offset, memory.offset + n);
      memory.offset += n;
      return n;
    },
  ),
}));
vi.mock("../scripts/backup/workspace", () => ({
  restrict: (p: string) => memory.restricted(p),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  lstat: vi.fn(async () => ({ isSymbolicLink: () => memory.symlink })),
  realpath: vi.fn(async (p: string) => resolve(p)),
  stat: vi.fn(async () => ({ size: 1000 })),
  readFile: vi.fn(async (p: string) => {
    if (!memory.files.has(p)) throw Error("missing");
    return memory.files.get(p);
  }),
  writeFile: vi.fn(async (p: string, v: string, options: unknown) => {
    memory.writes(p, v, options);
    if (memory.files.has(p)) throw Error("exists");
    memory.files.set(p, v);
  }),
}));
beforeEach(() => {
  memory.files.clear();
  memory.symlink = false;
  memory.restricted.mockClear();
  memory.writes.mockClear();
  memory.input.fill(0);
  memory.input = Buffer.alloc(0);
  memory.offset = 0;
});
afterEach(() => {
  memory.files.clear();
  memory.input.fill(0);
  vi.unstubAllEnvs();
});
describe("encrypted local vault adapter — filesystem held only in RAM", () => {
  it.each(["3", "12"])(
    "reads passphrase only from inherited descriptor %s",
    async (fd) => {
      vi.stubEnv("BACKUP_KEY_PASSPHRASE_FD", fd);
      memory.input = randomBytes(32);
      const value = await readPassphrase();
      try {
        expect(value.equals(memory.input)).toBe(true);
      } finally {
        value.fill(0);
      }
    },
  );
  it("rejects stdio as a passphrase descriptor", async () => {
    vi.stubEnv("BACKUP_KEY_PASSPHRASE_FD", "0");
    await expect(readPassphrase()).rejects.toThrow("PASSPHRASE_FD_INVALID");
  });
  it("rejects oversized inherited passphrases", async () => {
    vi.stubEnv("BACKUP_KEY_PASSPHRASE_FD", "3");
    memory.input = Buffer.alloc(1025, 7);
    await expect(readPassphrase()).rejects.toThrow("VAULT_PASSPHRASE_INVALID");
  });
  it("restricts directory then exclusively writes only a protected envelope", async () => {
    const key = BackupKey.generate(),
      pass = randomBytes(32);
    try {
      await saveVaultKey(key, pass);
      expect(memory.restricted).toHaveBeenCalledWith(
        resolve(".data/backup-keys"),
      );
      expect(memory.writes.mock.calls[0][2]).toEqual({
        flag: "wx",
        mode: 0o600,
      });
      key.use((k) =>
        expect(
          [...memory.files.values()].join("").includes(k.toString("base64")),
        ).toBe(false),
      );
      const read = await loadVaultKey(key.keyId, pass);
      try {
        expect(key.use((k) => read.use((r) => r.equals(k)))).toBe(true);
      } finally {
        read.dispose();
      }
      await expect(saveVaultKey(key, pass)).rejects.toThrow();
    } finally {
      key.dispose();
      pass.fill(0);
    }
  });
  it("rejects symlink directories without a write", async () => {
    memory.symlink = true;
    const key = BackupKey.generate(),
      pass = randomBytes(32);
    try {
      await expect(saveVaultKey(key, pass)).rejects.toThrow(
        "KEY_VAULT_PATH_REJECTED",
      );
      expect(memory.writes).not.toHaveBeenCalled();
    } finally {
      key.dispose();
      pass.fill(0);
    }
  });
  it("rejects missing and traversal key IDs safely", async () => {
    const pass = randomBytes(32);
    try {
      await expect(loadVaultKey("missing", pass)).rejects.toThrow(
        "BACKUP_KEY_NOT_FOUND_OR_UNREADABLE",
      );
      await expect(loadVaultKey("../escape", pass)).rejects.toThrow(
        "KEY_ID_INVALID",
      );
    } finally {
      pass.fill(0);
    }
  });
});
