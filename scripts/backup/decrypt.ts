import { createReadStream } from "node:fs";
import { realpath, lstat, rm, open } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import {
  verifyFile,
  archiveDecipher,
  digestFile,
  requireCheck,
  BackupError,
} from "./core";
import { restrict } from "./workspace";

// Never call pg_restore before this promise succeeds. A second authenticated pass
// writes only inside an operator-private directory; errors remove that exact file.
export async function decryptToPrivateFile(
  archive: string,
  value: unknown,
  key: Buffer,
  keyId: string,
  directory: string,
) {
  const verified = await verifyFile(archive, value, key, keyId);
  const dir = resolve(directory);
  requireCheck(
    !(await lstat(dir)).isSymbolicLink() &&
      (await realpath(dir)).toLowerCase() === dir.toLowerCase(),
    "DECRYPT_TARGET_REJECTED",
  );
  await restrict(dir);
  const output = join(dir, "decrypted-" + randomUUID() + ".dump");
  const handle = await open(output, "wx", 0o600);
  try {
    await pipeline(
      createReadStream(archive),
      archiveDecipher(verified.manifest, key),
      handle.createWriteStream(),
    );
    const digest = await digestFile(output);
    requireCheck(
      digest.sha256 === verified.plaintextSha256 &&
        digest.size === verified.plaintextSize,
      "DECRYPTED_FILE_MISMATCH",
    );
    return output;
  } catch (e) {
    await handle.close().catch(() => {});
    await rm(output, { force: true });
    if (e instanceof BackupError) throw e;
    throw new BackupError("DECRYPT_FILE_FAILED");
  } finally {
    await handle.close().catch(() => {});
  }
}
