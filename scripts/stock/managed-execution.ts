// Execution mechanism rehearsal ONLY. No CLI/env loader/provider constructor.
// The public managed --apply gate remains unconditionally disabled.
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Client } from "pg";
import { check, hash } from "../db/migration-safety";
import {
  localIdentity,
  stockChecksum,
  stockMigration,
  stockFiles,
} from "./migrate";
import {
  collectManagedSnapshot,
  collectManagedPostSnapshot,
  expectedManagedPost,
  loadManagedContract,
  validateContract,
  verifyManagedDelta,
  managedFailureState,
  type ManagedSnapshot,
} from "./managed-contract";

export type ManagedExecutionResult = {
  status: "LOCAL_REHEARSAL_PASS" | "STOPPED_REVIEW_REQUIRED";
  state: string;
  applied: boolean | null;
  retryAllowed: false;
  cloudAccepted: false;
  code?: string;
  warnings: string[];
};
export async function rehearseManaged016(
  admin: Client,
  actor: Client,
  env: NodeJS.ProcessEnv,
  reviewedPre: ManagedSnapshot,
  hooks: {
    beforeSql?: () => Promise<void>;
    beforeCommit?: () => Promise<void>;
    discardCommitReply?: boolean;
    afterCommit?: () => Promise<void>;
  } = {},
): Promise<ManagedExecutionResult> {
  // Verification runs before locks, transactions or any writing statement.
  await localIdentity(admin, env);
  const parameters = (
    actor as unknown as {
      connectionParameters: {
        host: string;
        port: number;
        database: string;
        user: string;
      };
    }
  ).connectionParameters;
  const localUrl = new URL(env.TEST_DIRECT_DATABASE_URL!);
  check(
    parameters?.host === "127.0.0.1" &&
      parameters.port === Number(localUrl.port) &&
      parameters.database === "pusula_sprint_b_test" &&
      parameters.user === "fixture_managed_owner",
    "STOCK_REHEARSAL_LOCAL_CONNECTION_REQUIRED",
  );
  const identity = (
    await actor.query(
      "SELECT current_user actor,session_user session_actor,current_database() db,host(inet_server_addr()) host,inet_server_port() port,pg_backend_pid() pid,current_setting('server_version_num')::int version",
    )
  ).rows[0];
  const u = new URL(env.TEST_DIRECT_DATABASE_URL!);
  check(
    identity.host === "127.0.0.1" &&
      identity.port === Number(u.port) &&
      identity.db === "pusula_sprint_b_test" &&
      identity.actor === "fixture_managed_owner" &&
      identity.session_actor === identity.actor &&
      identity.version === 180006,
    "STOCK_REHEARSAL_LOCAL_SESSION_REQUIRED",
  );
  const c = await loadManagedContract();
  validateContract(c);
  const fixturePins = JSON.parse(
    await readFile("scripts/stock/managed-fixture-baseline.json", "utf8"),
  );
  check(
    hash(reviewedPre.security) === fixturePins.pre,
    "STOCK_REHEARSAL_PRE_ACL_PIN_DRIFT",
  );
  const files = (await stockFiles()).files;
  check(
    hash(reviewedPre.schema) === hash(c.pre.schema) &&
      reviewedPre.grantors !== null,
    "STOCK_REHEARSAL_PRE_REQUIRED",
  );
  const sql = await readFile(
    `prisma/migrations/${stockMigration}/migration.sql`,
    "utf8",
  );
  check(
    createHash("sha256").update(sql).digest("hex") === stockChecksum,
    "STOCK_REHEARSAL_SQL_CHECKSUM",
  );
  const body = sql.replace(/^BEGIN;\s*/, "").replace(/COMMIT;\s*$/, "");
  check(
    body !== sql && !/\bCOMMIT\s*;/i.test(body),
    "STOCK_REHEARSAL_TRANSACTION_BOUNDARY",
  );
  // Source/fixture-pinned delta is calculated BEFORE any observed post exists.
  const expected = expectedManagedPost(
    reviewedPre,
    c.permissions,
    c.postSchema,
  );
  verifyManagedDelta(reviewedPre, expected, c.permissions, c.postSchema, files);
  const warnings: string[] = [];
  const notice = (n: { code?: string }) => {
    if (n.code?.startsWith("01")) warnings.push(n.code);
  };
  actor.on("notice", notice);
  let phase: "before-apply" | "transaction" | "commit-sent" | "committed" =
      "before-apply",
    locked = false;
  const snapshot = async () => {
    await actor.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      return await collectManagedSnapshot(actor);
    } finally {
      await actor.query("ROLLBACK");
    }
  };
  try {
    locked = (await actor.query("SELECT pg_try_advisory_lock(2142042) locked"))
      .rows[0].locked;
    check(locked, "STOCK_REHEARSAL_BUSY");
    check(
      hash(await snapshot()) === hash(reviewedPre),
      "STOCK_REHEARSAL_PREFLIGHT_DRIFT",
    );
    await actor.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    phase = "transaction";
    await hooks.beforeSql?.();
    await actor.query(body);
    await actor.query(
      "INSERT INTO public._prisma_migrations(id,checksum,migration_name,finished_at,applied_steps_count) VALUES($1,$2,$3,now(),1)",
      [randomUUID(), stockChecksum, stockMigration],
    );
    await hooks.beforeCommit?.();
    check(warnings.length === 0, "STOCK_REHEARSAL_ACL_WARNING");
    const post = await collectManagedPostSnapshot(actor);
    verifyManagedDelta(reviewedPre, post, c.permissions, c.postSchema, files);
    check(hash(post) === hash(expected), "STOCK_REHEARSAL_PRECOMMIT_DRIFT");
    check(
      (
        await actor.query(
          "SELECT pg_backend_pid() pid,current_user actor,session_user session_actor",
        )
      ).rows[0].pid === identity.pid,
      "STOCK_REHEARSAL_SESSION_CHANGED",
    );
    phase = "commit-sent";
    await actor.query("COMMIT");
    if (hooks.discardCommitReply)
      throw Error("STOCK_REHEARSAL_COMMIT_REPLY_LOST");
    phase = "committed";
    await hooks.afterCommit?.();
    const final = await snapshot();
    verifyManagedDelta(reviewedPre, final, c.permissions, c.postSchema, files);
    return {
      status: "LOCAL_REHEARSAL_PASS",
      state: "COMMITTED_INVARIANTS_ONLY",
      applied: true,
      retryAllowed: false,
      cloudAccepted: false,
      warnings,
    };
  } catch (error) {
    let confirmed = false;
    if (phase === "transaction") {
      try {
        await actor.query("ROLLBACK");
        confirmed = hash(await snapshot()) === hash(reviewedPre);
      } catch {
        confirmed = false;
      }
    }
    const e = error as { code?: string; message?: string };
    const code =
      [e.code, e.message].find(
        (s) => s && (/^[A-Z0-9_]+$/.test(s) || /^STOCK_[A-Za-z0-9_]+$/.test(s)),
      ) ?? "STOCK_REHEARSAL_FAILED";
    return {
      status: "STOPPED_REVIEW_REQUIRED",
      state: managedFailureState(phase, confirmed),
      applied:
        phase === "before-apply" || confirmed
          ? false
          : phase === "committed"
            ? true
            : null,
      retryAllowed: false,
      cloudAccepted: false,
      code,
      warnings,
    };
  } finally {
    actor.removeListener("notice", notice);
    // Unknown COMMIT or post-COMMIT failure is not "fixed" with rollback/reapply.
    // Its caller closes the dedicated session to release the lock.
    if (locked && phase !== "commit-sent" && phase !== "committed")
      await actor.query("SELECT pg_advisory_unlock(2142042)").catch(() => {});
    if (locked && phase === "committed")
      await actor.query("SELECT pg_advisory_unlock(2142042)").catch(() => {});
  }
}
