import { loadEnvConfig } from "@next/env";
import { join } from "node:path";
import { mkdir, rename, readdir, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  BackupError,
  keyFromEnv,
  requireCheck,
  newContext,
  sealFile,
  saveManifest,
  readManifest,
  verifyFile,
  authenticateManifest,
} from "./core";
import {
  sourceTarget,
  checkTools,
  checkLibpqConnection,
  inspectSource,
  runTool,
  toolPath,
  pgEnvironment,
  validateToc,
} from "./postgres";
import { createStorage } from "./storage";
import { privateRoot, scratch, removeScratch, lock } from "./workspace";

loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const args = process.argv.slice(2),
  command = args[0],
  started = Date.now(),
  jobId = randomUUID();
const emit = (data: object) => console.log(JSON.stringify({ jobId, ...data }));
const key = () => keyFromEnv(process.env.BACKUP_ENCRYPTION_KEY);
const keyId = () => {
  const id = process.env.BACKUP_KEY_ID;
  requireCheck(id && /^[A-Za-z0-9_-]{1,64}$/.test(id), "KEY_ID_MISSING");
  return id;
};
const idArg = () => {
  const id = args[1];
  requireCheck(
    id &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        id,
      ),
    "BACKUP_ID_REQUIRED",
  );
  return id;
};
async function r2Security() {
  // Bucket-scoped S3 credentials cannot inspect control-plane public/domain/token policy.
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token)
    return {
      publicAccess: "not-verified",
      tokenScope: "dashboard-review-required",
    };
  const account = process.env.R2_ACCOUNT_ID;
  requireCheck(account && /^[a-f0-9]{32}$/i.test(account), "R2_CONFIG_MISSING");
  for (const kind of ["managed", "custom"]) {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/pusula-backups-development/domains/${kind}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    requireCheck(r.ok, "R2_SECURITY_AUDIT_FAILED");
    const body = (await r.json()) as {
      success: boolean;
      result?: { enabled?: boolean; domains?: { enabled: boolean }[] };
    };
    requireCheck(body.success && body.result, "R2_SECURITY_AUDIT_FAILED");
    if (kind === "managed")
      requireCheck(
        body.result.enabled === false,
        "R2_PUBLIC_ACCESS_ENABLED_OR_UNKNOWN",
      );
    else
      requireCheck(
        Array.isArray(body.result.domains) &&
          body.result.domains.every((d) => d.enabled === false),
        "R2_PUBLIC_ACCESS_ENABLED_OR_UNKNOWN",
      );
  }
  return {
    publicAccess: "managed-and-custom-disabled",
    tokenScope: "dashboard-review-required",
  };
}
async function preflight() {
  let failed = false;
  async function check(name: string, fn: () => Promise<unknown>) {
    try {
      emit({ check: name, status: "pass", result: await fn() });
    } catch (e) {
      failed = true;
      emit({ check: name, status: "blocked", code: safeCode(e) });
    }
  }
  await check("encryption", async () => {
    key();
    keyId();
    return "configured";
  });
  await check("postgres-tools", checkTools);
  await check("source-role-and-coverage", async () => {
    const u = sourceTarget(process.env.BACKUP_SOURCE_DATABASE_URL);
    await checkLibpqConnection(u);
    const source = await inspectSource(u);
    try {
      return {
        version: source.version,
        tables: source.tables,
        schemaVersion: source.schemaVersion,
      };
    } finally {
      await source.db.query("ROLLBACK").catch(() => {});
      await source.db.end();
    }
  });
  await check("r2-head-bucket", async () => {
    const s = createStorage();
    try {
      await s.headBucket();
      return { bucket: s.bucket, region: "auto" };
    } finally {
      (s.client as { destroy?: () => void }).destroy?.();
    }
  });
  await check("r2-public-and-token-policy", async () => {
    const result = await r2Security();
    requireCheck(
      result.publicAccess !== "not-verified",
      "R2_SECURITY_REVIEW_REQUIRED",
    );
    return result;
  });
  // Token scope needs an operator review even if public settings were observable.
  await check("r2-token-scope", async () => {
    requireCheck(
      args.includes("--confirm-r2-security-reviewed"),
      "R2_TOKEN_SCOPE_REVIEW_REQUIRED",
    );
    return "operator-attested-not-independently-verified";
  });
  if (failed) process.exitCode = 1;
}
function safeCode(e: unknown) {
  return e instanceof BackupError ? e.code : "BACKUP_OPERATION_FAILED";
}
async function main() {
  requireCheck(
    process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
    "TLS_VERIFICATION_REQUIRED",
  );
  requireCheck(process.env.NODE_ENV !== "production", "PRODUCTION_FORBIDDEN");
  if (command === "preflight") return preflight();
  requireCheck(
    ["create", "upload", "verify", "list"].includes(command),
    "COMMAND_INVALID",
  );
  const root = await privateRoot();
  if (command === "list") {
    if (args.includes("--remote")) {
      const storage = createStorage();
      for (const objectKey of await storage.list())
        emit({ objectKey, status: "unverified-remote-candidate" });
    } else {
      for (const id of await readdir(root)) {
        if (!/^[a-f0-9-]{36}$/.test(id)) continue;
        const value = await readManifest(join(root, id, "manifest.json"));
        const m = authenticateManifest(value, key(), keyId());
        emit({
          backupId: m.backupId,
          createdAt: m.createdAt,
          ciphertextSize: m.ciphertextSize,
          status: "authenticated-manifest-only",
        });
      }
    }
    return;
  }
  const fixture = args.includes("--fixture");
  if (command === "create")
    requireCheck(
      args.includes(
        fixture ? "--approve-fixture-dump" : "--approve-development-dump",
      ),
      "DUMP_OPERATOR_APPROVAL_REQUIRED",
    );
  if (command === "upload") {
    requireCheck(
      args.includes("--approve-r2-write"),
      "UPLOAD_OPERATOR_APPROVAL_REQUIRED",
    );
    requireCheck(
      args.includes("--confirm-r2-security-reviewed"),
      "R2_SECURITY_REVIEW_REQUIRED",
    );
  }
  const release = await lock(root).catch(() => {
    throw new BackupError("BACKUP_LOCKED");
  });
  let dir: string;
  try {
    dir = await scratch(root);
  } catch (e) {
    await release();
    throw e;
  }
  try {
    const secret = key(),
      kid = keyId();
    if (command === "create") {
      await checkTools();
      const u = sourceTarget(
        process.env[
          fixture ? "BACKUP_FIXTURE_DATABASE_URL" : "BACKUP_SOURCE_DATABASE_URL"
        ],
        fixture,
      );
      await checkLibpqConnection(u);
      if (!fixture) {
        const storage = createStorage();
        await storage.headBucket();
        const security = await r2Security();
        requireCheck(
          security.publicAccess !== "not-verified" ||
            args.includes("--confirm-r2-security-reviewed"),
          "R2_SECURITY_REVIEW_REQUIRED",
        );
      }
      const source = await inspectSource(u);
      try {
        const dump = join(dir, "source.dump");
        await runTool(
          toolPath("pg_dump"),
          [
            "-Fc",
            "--no-password",
            "--snapshot=" + source.snapshot,
            "--file=" + dump,
          ],
          pgEnvironment(u),
          600000,
        );
        const toc = await runTool(toolPath("pg_restore"), ["--list", dump]);
        validateToc(toc);
        const ctx = newContext({
          sourceEnvironment: fixture ? "fixture" : "development",
          databaseVersion: source.version,
          schemaVersion: source.schemaVersion,
          coverageSha256: source.coverageSha256,
          keyId: kid,
        });
        const archive = join(dir, "archive.gcm");
        const m = await sealFile(dump, archive, ctx, secret);
        const target = join(root, m.backupId);
        await mkdir(target, { mode: 0o700 });
        await rename(archive, join(target, "archive.gcm"));
        await saveManifest(join(target, "manifest.json"), m);
        emit({
          status: "encrypted-local-verified",
          backupId: m.backupId,
          ciphertextSize: m.ciphertextSize,
          databaseVersion: m.databaseVersion,
          objectKey: m.objectKey,
        });
      } finally {
        await source.db.query("ROLLBACK").catch(() => {});
        await source.db.end();
      }
    } else {
      const id = idArg(),
        manifestPath = join(root, id, "manifest.json"),
        archive = join(root, id, "archive.gcm");
      if (command === "verify" && args.includes("--remote")) {
        const storage = createStorage();
        await storage.getFile(
          `development/v1/${id}/manifest.json`,
          join(dir, "manifest.json"),
          16384,
        );
        const m = authenticateManifest(
          await readManifest(join(dir, "manifest.json")),
          secret,
          kid,
        );
        requireCheck(m.backupId === id, "BACKUP_ID_MISMATCH");
        await storage.downloadVerify(m, dir, secret, kid);
        emit({ backupId: id, status: "remote-verified" });
      } else {
        const m = authenticateManifest(
          await readManifest(manifestPath),
          secret,
          kid,
        );
        requireCheck(m.backupId === id, "BACKUP_ID_MISMATCH");
        await verifyFile(archive, m, secret, kid);
        if (command === "upload")
          emit(await createStorage().upload(archive, m, secret, kid, dir));
        else
          emit({
            backupId: id,
            status: "encrypted-local-verified",
            ciphertextSize: (await stat(archive)).size,
          });
      }
    }
  } finally {
    try {
      await removeScratch(root, dir);
    } finally {
      await release();
    }
  }
}
main()
  .then(() =>
    emit({
      status: process.exitCode ? "blocked" : "command-complete",
      durationMs: Date.now() - started,
    }),
  )
  .catch((e) => {
    emit({
      status: "failed",
      code: safeCode(e),
      durationMs: Date.now() - started,
    });
    process.exitCode = 1;
  });
