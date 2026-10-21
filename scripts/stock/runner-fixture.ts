import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import {
  inspectStock,
  localIdentity,
  requireLocalGate,
  runStock,
  stockMigration,
  type AclPins,
} from "./migrate";
import { MigrationSafetyError } from "../db/migration-safety";
import { catalog, hash } from "../db/migration-safety";

const pass = (name: string) =>
  console.log(JSON.stringify({ stockRunnerCheck: name, status: "PASS" }));
const rejected = async (fn: () => Promise<unknown>, code: string) => {
  await assert.rejects(fn, (e: unknown) => {
    const actual =
      e instanceof MigrationSafetyError
        ? e.code
        : (e as { code?: string }).code;
    if (actual !== code)
      console.log(
        JSON.stringify({
          stockRunnerExpected: code,
          actual: actual ?? "UNCLASSIFIED",
        }),
      );
    return e instanceof MigrationSafetyError && e.code === code;
  });
  pass(code);
};

export async function runnerPre(
  db: Client,
  env: NodeJS.ProcessEnv,
  measure: boolean,
) {
  await localIdentity(db, env);
  const before = await inspectStock(db);
  assert.equal(before.state, "PREFLIGHT_PASS");
  const pins: AclPins = measure
    ? { pre: before.acl, post: "0".repeat(64) }
    : JSON.parse(await readFile("scripts/stock/runner-baseline.json", "utf8"));
  await inspectStock(db, pins);
  pass(
    measure ? "preflight-40-26-15-measurement" : "preflight-40-26-15-pinned",
  );
  assert.throws(
    () => requireLocalGate([], { NODE_ENV: "test" }),
    /STOCK_CLOUD_APPROVAL_REQUIRED/,
  );
  assert.throws(
    () => requireLocalGate(["--test", "--apply"], env),
    /STOCK_LOCAL_APPROVAL_REQUIRED/,
  );
  pass("cloud-and-unapproved-apply-sealed-before-connection");
  await rejected(
    () => inspectStock(db, { ...pins, pre: "0".repeat(64) }),
    "STOCK_ACL_DRIFT",
  );
  await db.query(
    'ALTER TABLE public."Customer" ADD COLUMN fixture_runner_drift text',
  );
  try {
    await rejected(() => inspectStock(db, pins), "STOCK_SCHEMA_DRIFT_columns");
  } finally {
    await db.query(
      'ALTER TABLE public."Customer" DROP COLUMN fixture_runner_drift',
    );
  }
  await db.query('CREATE TABLE public."StockLot"(id uuid)');
  try {
    await rejected(() => inspectStock(db, pins), "STOCK_SCHEMA_DRIFT_tables");
  } finally {
    await db.query('DROP TABLE public."StockLot"');
  }
  await db.query('GRANT DELETE ON public."PurchaseOrder" TO pusula_runtime');
  try {
    await rejected(() => inspectStock(db, pins), "STOCK_ACL_DRIFT");
  } finally {
    await db.query(
      'REVOKE DELETE ON public."PurchaseOrder" FROM pusula_runtime',
    );
  }
  await db.query(
    `INSERT INTO public._prisma_migrations(id,checksum,migration_name,applied_steps_count) VALUES('fixture-failed-016',$1,$2,0)`,
    ["0".repeat(64), stockMigration],
  );
  try {
    await rejected(() => inspectStock(db, pins), "STOCK_MIGRATION_UNRESOLVED");
  } finally {
    await db.query(
      "DELETE FROM public._prisma_migrations WHERE id='fixture-failed-016'",
    );
  }
  // Preflight must be non-mutating and restore its transaction state after errors.
  assert.deepEqual(await runStock(db, env, { pins }), before);
  await rejected(
    () => runStock(db, env, { pins, apply: true }),
    "STOCK_LOCAL_APPROVAL_REQUIRED",
  );
  return { pins, pre: before.acl };
}

export async function runnerPost(
  db: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
  pre: string,
  pins: AclPins,
  measure: boolean,
) {
  const after = await inspectStock(db, measure ? undefined : pins);
  assert.equal(after.state, "ALREADY_APPLIED");
  await writeFile(
    join(dir, "stock-runner-acl-measured.json"),
    JSON.stringify({ pre, post: after.acl }, null, 2),
  );
  if (measure) {
    pass("acl-measured-only-not-enrolled");
    return;
  }
  const history = (
    await db.query(
      "SELECT * FROM public._prisma_migrations ORDER BY migration_name",
    )
  ).rows;
  assert.equal(
    (await runStock(db, env, { pins, apply: true, approved: true })).state,
    "ALREADY_APPLIED",
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT * FROM public._prisma_migrations ORDER BY migration_name",
      )
    ).rows,
    history,
  );
  pass("already-applied-no-second-deploy-no-history-change");
  await db.query('GRANT INSERT ON public."StockMovement" TO pusula_runtime');
  try {
    await rejected(() => inspectStock(db, pins), "STOCK_ACL_DRIFT");
  } finally {
    await db.query(
      'REVOKE INSERT ON public."StockMovement" FROM pusula_runtime',
    );
  }
  await db.query("ALTER ROLE pusula_stock_executor BYPASSRLS");
  try {
    await rejected(() => inspectStock(db, pins), "STOCK_ACL_DRIFT");
  } finally {
    await db.query("ALTER ROLE pusula_stock_executor NOBYPASSRLS");
  }
  await db.query('ALTER TABLE public."StockLot" NO FORCE ROW LEVEL SECURITY');
  try {
    await rejected(() => inspectStock(db, pins), "STOCK_SCHEMA_DRIFT_tables");
  } finally {
    await db.query('ALTER TABLE public."StockLot" FORCE ROW LEVEL SECURITY');
  }
  await db.query(
    "UPDATE public._prisma_migrations SET checksum=$1 WHERE migration_name=$2",
    ["0".repeat(64), stockMigration],
  );
  try {
    await rejected(
      () => inspectStock(db, pins),
      "STOCK_HISTORY_CHECKSUM_REJECTED",
    );
  } finally {
    await db.query(
      "UPDATE public._prisma_migrations SET checksum=$1 WHERE migration_name=$2",
      [history[15].checksum, stockMigration],
    );
  }
  assert.equal((await inspectStock(db, pins)).state, "ALREADY_APPLIED");
  // Malformed temporary shadows must not replace schema-qualified PO lookups.
  await db.query('CREATE TEMP TABLE "PurchaseOrder"(fake text)');
  try {
    await assert.rejects(
      () => db.query("SELECT public.v43b_order_received($1::uuid)", [null]),
      (e: unknown) => (e as { code: string }).code === "42501",
    );
  } finally {
    await db.query('DROP TABLE pg_temp."PurchaseOrder"');
  }
  pass("temporary-po-shadow-cannot-replace-public-definer-table");
  pass("postflight-47-33-16-role-acl-rls-functions-permissions-pinned");
}

export async function runnerLockFailure(
  db: Client,
  env: NodeJS.ProcessEnv,
  pins: AclPins,
) {
  const blocker = new Client({
    connectionString: env.TEST_DIRECT_DATABASE_URL,
  });
  await blocker.connect();
  const before = await catalog(db);
  try {
    await blocker.query("SELECT pg_advisory_lock(2142042)");
    await rejected(() => runStock(db, env, { pins }), "STOCK_RUNNER_BUSY");
    await blocker.query("SELECT pg_advisory_unlock(2142042)");
    await blocker.query("BEGIN");
    await blocker.query(
      'LOCK TABLE public."PurchaseOrder" IN ACCESS EXCLUSIVE MODE',
    );
    await rejected(
      () => runStock(db, env, { pins }),
      "STOCK_PREFLIGHT_LOCK_TIMEOUT",
    );
    await blocker.query("ROLLBACK");
    await rejected(
      () =>
        runStock(db, env, {
          pins,
          apply: true,
          approved: true,
          fixtureBeforeApply: async () => {
            await blocker.query("BEGIN");
            await blocker.query(
              'LOCK TABLE public."PurchaseOrder" IN ACCESS EXCLUSIVE MODE',
            );
          },
        }),
      "STOCK_APPLY_STOPPED_REVIEW_REQUIRED",
    );
  } finally {
    await blocker.query("ROLLBACK");
    await blocker.end();
  }
  await rejected(() => inspectStock(db, pins), "STOCK_MIGRATION_UNRESOLVED");
  const after = await catalog(db);
  assert.equal(hash(before), hash(after));
  assert.equal(
    (
      await db.query(
        "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pusula_stock_executor') yes",
      )
    ).rows[0].yes,
    false,
  );
  const failures = (
    await db.query(
      "SELECT id FROM public._prisma_migrations WHERE migration_name=$1 AND finished_at IS NULL AND rolled_back_at IS NULL",
      [stockMigration],
    )
  ).rows;
  assert.equal(failures.length, 1);
  // Explicit fixture cleanup only. The runner itself never resolves/deletes history.
  await db.query("DELETE FROM public._prisma_migrations WHERE id=$1", [
    failures[0].id,
  ]);
  await inspectStock(db, pins);
  pass("real-prisma-3s-lock-failure-atomic-schema-rollback-history-review");
}
