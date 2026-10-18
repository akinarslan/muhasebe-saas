import { BackupKey } from "./keys";
import { saveVaultKey, confirmPassphrase, readPassphrase } from "./key-vault";
import { BackupError, requireCheck } from "./core";
async function main() {
  requireCheck(process.env.NODE_ENV !== "production", "PRODUCTION_FORBIDDEN");
  requireCheck(
    process.argv.includes("--approve-key-generation"),
    "KEY_GENERATION_APPROVAL_REQUIRED",
  );
  requireCheck(
    process.argv.includes("--confirm-recovery-plan"),
    "KEY_RECOVERY_PLAN_REQUIRED",
  );
  const pass =
    process.env.BACKUP_KEY_PASSPHRASE_FD === undefined
      ? await confirmPassphrase()
      : await readPassphrase();
  let key: BackupKey | undefined;
  try {
    key = BackupKey.generate();
    await saveVaultKey(key, pass);
    console.log(
      JSON.stringify({
        status: "encrypted-key-created",
        keyId: key.keyId,
        activeKeyChanged: false,
        recoveryCopiesVerified: false,
      }),
    );
  } finally {
    pass.fill(0);
    key?.dispose();
  }
}
main().catch((e) => {
  console.log(
    JSON.stringify({
      status: "blocked",
      code: e instanceof BackupError ? e.code : "KEY_OPERATION_FAILED",
    }),
  );
  process.exitCode = 1;
});
