import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import {
  migrationTarget,
  migrationClient,
  migrationFiles,
  inspect,
  validateRemotePrivileges,
  check,
  MigrationSafetyError,
  limits,
} from "./migration-safety";

// Importing this module never loads env or connects. Used by the local fixture.
export async function runPrisma(
  db: Client,
  env: NodeJS.ProcessEnv,
  totalMs = limits.childMs,
) {
  check(totalMs > 0 && totalMs <= limits.childMs, "CHILD_LIMIT_REJECTED");
  const runId = randomUUID();
  let timedOut = false;
  const child = spawn(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--config",
      "prisma-safe.config.ts",
    ],
    {
      env: { ...env, PUSULA_MIGRATION_RUN_ID: runId },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    },
  );
  // Bounded RAM-only diagnostic tail; never forwarded, persisted or attached to errors.
  let tail = "";
  const consume = (bytes: Buffer) => {
    tail = (tail + bytes.toString()).slice(-16384);
  };
  child.stdout.on("data", consume);
  child.stderr.on("data", consume);
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, totalMs);
  let code: number | null;
  try {
    code = await new Promise<number | null>((accept, reject) => {
      child.once("error", () =>
        reject(new MigrationSafetyError("PRISMA_CHILD_UNAVAILABLE")),
      );
      child.once("close", accept);
    });
  } finally {
    clearTimeout(timer);
  }
  // Terminate only tagged sessions from this invocation; never other app/PG jobs.
  const sessions = await db.query(
    `SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND application_name=$1 AND pid<>pg_backend_pid()`,
    [`pusula_migrate_${runId}`],
  );
  for (const row of sessions.rows)
    await db.query("SELECT pg_terminate_backend($1)", [row.pid]);
  let active = 1;
  for (let attempt = 0; attempt < 50 && active; attempt++) {
    active = (
      await db.query(
        `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND application_name=$1`,
        [`pusula_migrate_${runId}`],
      )
    ).rows[0].n;
    if (active) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  check(active === 0, "PRISMA_BACKEND_STILL_ACTIVE");
  check(!timedOut, "PRISMA_CHILD_TIMEOUT");
  const failure = /55P03|lock timeout/i.test(tail)
    ? "PRISMA_LOCK_TIMEOUT"
    : /57014|statement timeout/i.test(tail)
      ? "PRISMA_STATEMENT_TIMEOUT"
      : "PRISMA_CHILD_FAILED";
  tail = "";
  check(code === 0, failure);
}
export async function inspectFailure(db: Client) {
  const rows = (
    await db.query(
      `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY 1`,
    )
  ).rows;
  const failed = (
    await db.query(
      `SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
    )
  ).rows[0].n;
  return {
    tables: rows.length,
    supplierTables: rows
      .filter((r) =>
        ["Supplier", "SupplierMaterial", "SupplierOfferVersion"].includes(
          r.relname,
        ),
      )
      .map((r) => r.relname),
    unresolvedMigrations: failed,
  };
}
export async function main(
  args = process.argv.slice(2),
  fixtureHooks?: { beforeApply: () => Promise<void> },
) {
  check(
    args.every((a) =>
      [
        "--test",
        "--apply",
        "--approve-development",
        "--recovery-reviewed",
        "--confirm-master-permissions",
      ].includes(a),
    ),
    "UNKNOWN_ARGUMENT",
  );
  if (!process.env.PUSULA_LOCAL_FIXTURE)
    nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const test = args.includes("--test");
  const u = migrationTarget(
    process.env[test ? "TEST_DIRECT_DATABASE_URL" : "DIRECT_DATABASE_URL"],
    test,
  );
  const pinned = JSON.parse(
    await readFile("scripts/db/migration-baseline.json", "utf8"),
  );
  check(!!pinned.appliedSchema, "APPLIED_SCHEMA_PIN_REQUIRED");
  const files = await migrationFiles();
  check(
    files.length === 14 &&
      files.every((f) => pinned.migrations[f.name] === f.checksum),
    "LOCAL_CHECKSUM_REJECTED",
  );
  const db = await migrationClient(u, test);
  try {
    await db.connect();
    if (!test) {
      const socket = (
        db as unknown as {
          connection: { stream: { encrypted: boolean; authorized: boolean } };
        }
      ).connection.stream;
      check(socket.encrypted && socket.authorized, "TLS_REJECTED");
    }
    check(
      (await db.query("SELECT pg_try_advisory_lock(2142042) AS locked")).rows[0]
        .locked,
      "MIGRATION_RUNNER_BUSY",
    );
    if (!test) await validateRemotePrivileges(db, pinned.privileges);
    const before = await inspect(
      db,
      files,
      pinned.schema,
      pinned.appliedSchema,
    );
    if (before.state === "ALREADY_APPLIED") {
      console.log(
        JSON.stringify({ status: "ALREADY_APPLIED", applied: false }),
      );
      return;
    }
    if (!args.includes("--apply")) {
      console.log(JSON.stringify({ status: "PREFLIGHT_PASS", applied: false }));
      return;
    }
    if (!test)
      check(
        args.includes("--approve-development") &&
          args.includes("--recovery-reviewed") &&
          args.includes("--confirm-master-permissions"),
        "DEVELOPMENT_APPROVAL_REQUIRED",
      );
    if (fixtureHooks) {
      check(test, "FIXTURE_HOOK_FORBIDDEN");
      await fixtureHooks.beforeApply();
    }
    try {
      await runPrisma(db, {
        ...process.env,
        PUSULA_DB_TARGET: test ? "test" : "development",
      });
    } catch (e) {
      console.log(
        JSON.stringify({
          status: "FAILED",
          code: e instanceof MigrationSafetyError ? e.code : "MIGRATION_FAILED",
          schema: await inspectFailure(db),
        }),
      );
      throw new MigrationSafetyError("MIGRATION_STOPPED_REVIEW_REQUIRED");
    }
    const after = await inspect(db, files, pinned.schema, pinned.appliedSchema);
    check(after.state === "ALREADY_APPLIED", "POSTFLIGHT_FAILED");
    console.log(
      JSON.stringify({
        status: "APPLIED",
        tables: after.current.tables.length,
        forced: 24,
      }),
    );
  } finally {
    await db.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(
      JSON.stringify({
        status: "BLOCKED",
        code:
          e instanceof MigrationSafetyError
            ? e.code
            : "MIGRATION_SAFETY_FAILED",
      }),
    );
    process.exitCode = 1;
  });
