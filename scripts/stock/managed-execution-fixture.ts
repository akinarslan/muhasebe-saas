import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Client } from "pg";
import { hash } from "../db/migration-safety";
import { fixtureSnapshot } from "./managed-contract-fixture";
import {
  rehearseManaged016,
  type ManagedExecutionResult,
} from "./managed-execution";
import type { ManagedSnapshot } from "./managed-contract";

export async function verifyManagedExecutionFixture(
  ...args: Parameters<typeof runManagedExecutionFixture>
) {
  try {
    return await runManagedExecutionFixture(...args);
  } catch (error) {
    await writeFile(
      join(args[3], "managed-execution-error.log"),
      String(error instanceof Error ? error.stack : error).replace(
        /postgres(?:ql)?:\/\/[^\s'"<>]+/gi,
        "[connection]",
      ),
    );
    throw error;
  }
}
async function runManagedExecutionFixture(
  admin: Client,
  actor: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
  pre: ManagedSnapshot,
  openSession: () => Promise<Client>,
) {
  const results: { name: string; result: ManagedExecutionResult }[] = [];
  const historyBefore = (
    await actor.query("SELECT * FROM _prisma_migrations ORDER BY id")
  ).rows;
  const unchanged = async () => {
    assert.equal(hash(await fixtureSnapshot(actor)), hash(pre));
    assert.deepEqual(
      (await actor.query("SELECT * FROM _prisma_migrations ORDER BY id")).rows,
      historyBefore,
    );
  };
  const run = async (
    name: string,
    hooks: Parameters<typeof rehearseManaged016>[4],
    state: string,
    code?: string,
  ) => {
    const result = await rehearseManaged016(admin, actor, env, pre, hooks);
    console.log(
      JSON.stringify({
        managedExecutionScenario: name,
        state: result.state,
        code: result.code,
      }),
    );
    assert.equal(result.state, state);
    assert.equal(result.retryAllowed, false);
    assert.equal(result.cloudAccepted, false);
    if (code) assert.equal(result.code, code);
    await unchanged();
    results.push({ name, result });
  };
  const blocker = await openSession();
  try {
    await blocker.query("SELECT pg_advisory_lock(2142042)");
    await run("busy-no-apply", {}, "NOT_STARTED", "STOCK_REHEARSAL_BUSY");
  } finally {
    await blocker.query("SELECT pg_advisory_unlock(2142042)");
    await blocker.end();
  }
  await actor.query(
    'ALTER TABLE "Customer" ADD COLUMN m016_fixture_drift text',
  );
  try {
    const r = await rehearseManaged016(admin, actor, env, pre);
    assert.equal(r.state, "NOT_STARTED");
    assert.equal(r.code, "STOCK_REHEARSAL_PREFLIGHT_DRIFT");
    results.push({ name: "drift-no-apply", result: r });
  } finally {
    await actor.query('ALTER TABLE "Customer" DROP COLUMN m016_fixture_drift');
  }
  await unchanged();
  await run(
    "permission-error",
    {
      beforeSql: async () => {
        await actor.query("SET LOCAL ROLE pusula_runtime");
      },
    },
    "ROLLED_BACK_CONFIRMED",
    "42501",
  );
  await run(
    "late-error",
    {
      beforeCommit: async () => {
        await actor.query("SELECT 1/0");
      },
    },
    "ROLLED_BACK_CONFIRMED",
    "22012",
  );
  await run(
    "public-execute",
    {
      beforeCommit: async () => {
        await actor.query(
          "GRANT EXECUTE ON FUNCTION v43b_immutable() TO PUBLIC",
        );
      },
    },
    "ROLLED_BACK_CONFIRMED",
  );
  await run(
    "creator-remnant",
    {
      beforeCommit: async () => {
        await actor.query("CREATE ROLE pusula_stock_role_creator NOLOGIN");
      },
    },
    "ROLLED_BACK_CONFIRMED",
  );
  await run(
    "ineffective-acl-warning",
    {
      beforeCommit: async () => {
        // Transport-level warning injection. The independent owner-boundary
        // fixture above separately proves actual ineffective GRANT/REVOKE warnings.
        await actor.query(
          "DO $$ BEGIN RAISE WARNING SQLSTATE '01007' USING MESSAGE='fixture-only ACL warning'; END $$;",
        );
      },
    },
    "ROLLED_BACK_CONFIRMED",
    "STOCK_REHEARSAL_ACL_WARNING",
  );
  const disconnected = await openSession();
  try {
    const r = await rehearseManaged016(admin, disconnected, env, pre, {
      beforeSql: async () => {
        await disconnected.end();
        throw Error("STOCK_FIXTURE_CONNECTION_CLOSED");
      },
    });
    assert.equal(r.state, "ROLLBACK_UNCONFIRMED");
    assert.equal(r.retryAllowed, false);
    assert.equal(r.applied, null);
    results.push({ name: "rollback-connection-lost-no-retry", result: r });
  } finally {
    await disconnected.end().catch(() => {});
  }
  await unchanged();
  const wire = await openSession();
  let result: ManagedExecutionResult;
  const unknown = process.argv.includes("--managed-commit-unknown"),
    postDrift = process.argv.includes("--managed-post-commit-drift");
  assert.ok(!(unknown && postDrift));
  try {
    result = await rehearseManaged016(admin, wire, env, pre, {
      discardCommitReply: unknown,
      afterCommit: postDrift
        ? async () => {
            await wire.query(
              'ALTER TABLE "StockLocation" ADD COLUMN m016_post_drift text',
            );
          }
        : undefined,
    });
  } finally {
    await wire.end();
  }
  if (unknown) {
    assert.equal(result.state, "COMMIT_OUTCOME_UNKNOWN");
    assert.equal(result.applied, null);
    assert.equal(result.status, "STOPPED_REVIEW_REQUIRED");
  } else if (postDrift) {
    assert.equal(result.state, "POST_COMMIT_REVIEW_REQUIRED");
    assert.equal(result.applied, true);
    assert.equal(result.status, "STOPPED_REVIEW_REQUIRED");
    await actor.query(
      'ALTER TABLE "StockLocation" DROP COLUMN m016_post_drift',
    );
  } else {
    assert.equal(result.status, "LOCAL_REHEARSAL_PASS");
    assert.equal(result.state, "COMMITTED_INVARIANTS_ONLY");
    assert.equal(result.applied, true);
  }
  assert.equal(result.retryAllowed, false);
  assert.equal(result.cloudAccepted, false);
  assert.equal(
    (
      await actor.query(
        "SELECT count(*)::int n FROM _prisma_migrations WHERE migration_name='202610210016_goods_receipts' AND finished_at IS NOT NULL AND rolled_back_at IS NULL",
      )
    ).rows[0].n,
    1,
  );
  for (const r of historyBefore)
    assert.deepEqual(
      (
        await actor.query("SELECT * FROM _prisma_migrations WHERE id=$1", [
          r.id,
        ])
      ).rows[0],
      r,
    );
  results.push({
    name: unknown
      ? "lost-commit-reply-independent-durable-single-history"
      : postDrift
        ? "post-commit-drift-no-rollback-no-retry"
        : "committed-independent-pre-and-post-contract",
    result,
  });
  await writeFile(
    join(dir, "managed-execution-rehearsal.json"),
    JSON.stringify(
      {
        status: "PASS",
        mode: unknown
          ? "COMMIT_OUTCOME_UNKNOWN"
          : postDrift
            ? "POST_COMMIT_REVIEW_REQUIRED"
            : "COMMITTED",
        localOnly: true,
        cloudApplyEnabled: false,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      managedExecutionRehearsal: "PASS",
      scenarios: results.length,
      commitOutcome: result.state,
      cloudAccepted: false,
    }),
  );
}
