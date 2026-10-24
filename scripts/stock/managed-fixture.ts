import { reviewedRollback008 } from "../db/migration-checksum";
import {
  fixtureSnapshot,
  verifyManagedContractFixture,
  proveManagedOwnerAclBoundary,
  verifyManagedFunctionAcl,
} from "./managed-contract-fixture";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import { catalog, hash, migrationTarget } from "../db/migration-safety";
import {
  inspectStock,
  localIdentity,
  stockChecksum,
  stockMigration,
  type AclPins,
} from "./migrate";

// Called only by the UUID/loopback/PG18.6 harness, after its immutable 001-015.
// This fixture has its own actor/profile. It never loads real environment files.
export async function verifyManagedFixture(
  admin: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
  measure: boolean,
) {
  await localIdentity(admin, env);
  const artifact = process.argv.includes("--checksum-git-artifact")
    ? await (
        await import("../db/verify-checksum-artifact")
      ).verifyChecksumArtifact()
    : undefined;
  const u = migrationTarget(env.TEST_DIRECT_DATABASE_URL, true);
  const password = randomBytes(32).toString("hex");
  const pass = (name: string) =>
    console.log(JSON.stringify({ managedCheck: name, status: "PASS" }));
  await admin.query(
    `CREATE ROLE fixture_managed_owner LOGIN PASSWORD '${password}' NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS NOREPLICATION`,
  );
  await admin.query(
    "ALTER DATABASE pusula_sprint_b_test OWNER TO fixture_managed_owner",
  );
  await admin.query("ALTER SCHEMA public OWNER TO pg_database_owner");
  for (const r of (
    await admin.query(
      `SELECT oid::regclass::text name FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY oid`,
    )
  ).rows)
    await admin.query(`ALTER TABLE ${r.name} OWNER TO fixture_managed_owner`);
  for (const r of (
    await admin.query(
      `SELECT oid::regprocedure::text name FROM pg_proc WHERE pronamespace='public'::regnamespace`,
    )
  ).rows)
    await admin.query(
      `ALTER FUNCTION ${r.name} OWNER TO fixture_managed_owner`,
    );
  for (const r of (
    await admin.query(
      `SELECT oid::regtype::text name FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e'`,
    )
  ).rows)
    await admin.query(`ALTER TYPE ${r.name} OWNER TO fixture_managed_owner`);
  // These simulate application login roles, not elevated managed provider roles.
  await admin.query(
    "ALTER ROLE pusula_runtime LOGIN; ALTER ROLE pusula_auth LOGIN",
  );
  const actor = new Client({
    host: "127.0.0.1",
    port: Number(u.port),
    database: u.pathname.slice(1),
    user: "fixture_managed_owner",
    password,
    connectionTimeoutMillis: 5000,
  });
  await actor.connect();
  try {
    const identity = (
      await actor.query(
        `SELECT current_user actor,session_user session_actor,current_setting('server_version_num') version,current_setting('createrole_self_grant') self_grant,rolsuper,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user`,
      )
    ).rows[0];
    assert.equal(identity.actor, "fixture_managed_owner");
    assert.equal(identity.session_actor, identity.actor);
    assert.equal(identity.rolsuper, false);
    assert.equal(identity.rolcreaterole, true);
    assert.equal(identity.self_grant, "");
    assert.equal(identity.version, "180006");
    pass("real-login-nonsuper-createrole-empty-self-grant-pg186");
    const sql = await readFile(
      `prisma/migrations/${stockMigration}/migration.sql`,
      "utf8",
    );
    const before = hash(await catalog(actor));
    const beforeSecurity = hash(await fixtureSnapshot(actor));
    async function rollbackFailure(text: string, code: string, name: string) {
      await assert.rejects(
        () => actor.query(text),
        (e: unknown) => (e as { code: string }).code === code,
      );
      await actor.query("ROLLBACK");
      assert.equal(hash(await catalog(actor)), before);
      assert.equal(hash(await fixtureSnapshot(actor)), beforeSecurity);
      assert.equal(
        (
          await actor.query(
            `SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pusula_stock_executor') yes`,
          )
        ).rows[0].yes,
        false,
      );
      pass(name);
    }
    await rollbackFailure(
      sql.replace(/^GRANT pusula_stock_executor TO SESSION_USER.*\n/m, ""),
      "42501",
      "original-missing-set-ownership-fails-42501-atomic-rollback",
    );
    await rollbackFailure(
      sql.replace(
        /^GRANT CREATE ON SCHEMA public TO pusula_stock_executor;\n/gm,
        "",
      ),
      "42501",
      "new-owner-needs-schema-create-42501-atomic-rollback",
    );
    await rollbackFailure(
      sql.replace(
        "GRANT EXECUTE ON FUNCTION v43b_command(text,jsonb) TO pusula_runtime;",
        "GRANT EXECUTE ON FUNCTION v43b_command(text,jsonb) TO pusula_runtime; SELECT 1/0;",
      ),
      "22012",
      "mid-acl-failure-with-executor-active-rolls-back-full-security-and-role",
    );
    await rollbackFailure(
      sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;"),
      "22012",
      "late-failure-rolls-back-role-membership-schema-and-permissions",
    );
    await actor.query(
      `INSERT INTO public._prisma_migrations(id,checksum,migration_name,rolled_back_at) VALUES($1,$2,'202610160008_company_metadata',now())`,
      [randomUUID(), reviewedRollback008],
    );
    const historyBefore = (
      await actor.query(`SELECT * FROM public._prisma_migrations ORDER BY id`)
    ).rows;
    const pre = await inspectStock(actor);
    assert.equal(pre.migrations, 15);
    if (artifact) {
      const cwd = process.cwd();
      try {
        process.chdir(artifact);
        assert.deepEqual(await inspectStock(actor), pre);
      } finally {
        process.chdir(cwd);
      }
      pass("real-pg-preflight-git-lf-vs-historical-checksums");
    }
    pass("resolved-008-retained-success-count-15-preflight");
    const contractPre = await fixtureSnapshot(actor);
    await proveManagedOwnerAclBoundary(admin, actor, env, dir);
    const candidateNotices: string[] = [];
    const notice = (n: { code?: string }) => {
      if (n.code) candidateNotices.push(n.code);
    };
    if (!process.argv.includes("--managed-execution-rehearsal"))
      actor.on("notice", notice);
    try {
      if (process.argv.includes("--managed-execution-rehearsal")) {
        const { verifyManagedExecutionFixture } =
          await import("./managed-execution-fixture");
        await verifyManagedExecutionFixture(
          admin,
          actor,
          env,
          dir,
          contractPre,
          async () => {
            const wire = new Client({
              host: "127.0.0.1",
              port: Number(u.port),
              database: u.pathname.slice(1),
              user: "fixture_managed_owner",
              password,
              connectionTimeoutMillis: 5000,
            });
            await wire.connect();
            return wire;
          },
        );
      } else await actor.query(sql);
    } finally {
      actor.removeListener("notice", notice);
    }
    assert.ok(!candidateNotices.some((c) => c === "01007" || c === "01006"));
    await writeFile(
      join(dir, "migration-notice-codes.json"),
      JSON.stringify(candidateNotices),
    );
    if (!process.argv.includes("--managed-execution-rehearsal"))
      await actor.query(
        `INSERT INTO public._prisma_migrations(id,checksum,migration_name,finished_at,applied_steps_count) VALUES($1,$2,$3,now(),1)`,
        [randomUUID(), stockChecksum, stockMigration],
      );
    const measuredSchema = Object.fromEntries(
      Object.entries(await catalog(actor)).map(([k, v]) => [k, hash(v)]),
    );
    await writeFile(
      join(dir, "stock-schema-measured.json"),
      JSON.stringify(
        { checksum: stockChecksum, schema: measuredSchema },
        null,
        2,
      ),
    );
    await writeFile(
      join(dir, "executor-membership.json"),
      JSON.stringify(
        (
          await actor.query(
            "SELECT pg_get_userbyid(roleid) parent,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='pusula_stock_executor'::regrole",
          )
        ).rows,
        null,
        2,
      ),
    );
    const after = await inspectStock(actor);
    if (artifact) {
      const cwd = process.cwd();
      try {
        process.chdir(artifact);
        assert.deepEqual(await inspectStock(actor), after);
      } finally {
        process.chdir(cwd);
      }
      pass("real-pg-postflight-git-lf-with-resolved-008-preserved");
    }
    assert.equal(after.tables, 47);
    assert.equal(after.forced, 33);
    assert.equal(after.migrations, 16);
    const pins: AclPins = { pre: pre.acl, post: after.acl };
    await writeFile(
      join(dir, "managed-acl-measured.json"),
      JSON.stringify(pins, null, 2),
    );
    const schema = Object.fromEntries(
      Object.entries(await catalog(actor)).map(([k, v]) => [k, hash(v)]),
    );
    await writeFile(
      join(dir, "stock-schema-measured.json"),
      JSON.stringify({ checksum: stockChecksum, schema }, null, 2),
    );
    if (!measure) {
      assert.deepEqual(
        pins,
        JSON.parse(
          await readFile("scripts/stock/managed-fixture-baseline.json", "utf8"),
        ),
      );
      await inspectStock(actor, pins);
    }
    for (const row of historyBefore)
      assert.deepEqual(
        (
          await actor.query(
            `SELECT * FROM public._prisma_migrations WHERE id=$1`,
            [row.id],
          )
        ).rows[0],
        row,
      );
    pass("committed-nonsuper-016-postflight-47-33-16-history-preserved");
    await verifyManagedFunctionAcl(admin, actor, env, dir);
    await verifyManagedContractFixture(admin, actor, contractPre, env, dir);
    const final = (
      await actor.query(
        `SELECT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='pusula_stock_executor'::regrole OR member='pusula_stock_executor'::regrole) members,has_schema_privilege('pusula_stock_executor','public','CREATE') create_schema,pg_has_role(current_user,'pusula_stock_executor','SET') actor_set,pg_has_role(current_user,'pusula_stock_executor','USAGE') actor_inherits`,
      )
    ).rows[0];
    assert.deepEqual(final, {
      members: false,
      create_schema: false,
      actor_set: false,
      actor_inherits: false,
    });
    const functions = (
      await actor.query(
        `SELECT proname,pg_get_userbyid(proowner) owner,prosecdef,proconfig FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef ORDER BY proname`,
      )
    ).rows;
    assert.equal(functions.length, 4);
    assert.ok(
      functions.every(
        (r) =>
          r.owner === "pusula_stock_executor" &&
          r.proconfig.includes("search_path=pg_catalog, public, pg_temp"),
      ),
    );
    pass(
      "all-temporary-memberships-admin-set-inherit-and-schema-create-revoked",
    );
    assert.equal(
      (
        await actor.query(
          `SELECT has_table_privilege('pusula_runtime','public."StockMovement"','INSERT,UPDATE,DELETE,TRUNCATE') unsafe,pg_has_role('pusula_runtime','pusula_stock_executor','MEMBER') member`,
        )
      ).rows[0].unsafe,
      false,
    );
    assert.equal(
      (
        await actor.query(
          `SELECT pg_has_role('pusula_runtime','pusula_stock_executor','MEMBER') member`,
        )
      ).rows[0].member,
      false,
    );
    // Actor cannot SET to executor after commit, despite having created it.
    await assert.rejects(
      () => actor.query("SET ROLE pusula_stock_executor"),
      (e: unknown) => (e as { code: string }).code === "42501",
    );
    pass(
      "runtime-no-executor-no-direct-ledger-dml-actor-set-denied-after-commit",
    );
    for (const [name, checksum, finished, rolledBack, expected] of [
      [
        stockMigration,
        stockChecksum,
        false,
        false,
        "STOCK_MIGRATION_UNRESOLVED",
      ],
      [
        stockMigration,
        "0".repeat(64),
        true,
        false,
        "STOCK_HISTORY_CHECKSUM_REJECTED",
      ],
      [stockMigration, stockChecksum, true, false, "STOCK_HISTORY_REJECTED"],
      [
        stockMigration,
        stockChecksum,
        false,
        true,
        "STOCK_MIGRATION_HISTORY_REVIEW_REQUIRED",
      ],
    ] as const) {
      const id = randomUUID();
      await actor.query(
        `INSERT INTO public._prisma_migrations(id,checksum,migration_name,finished_at,rolled_back_at) VALUES($1,$2,$3,CASE WHEN $4 THEN now() END,CASE WHEN $5 THEN now() END)`,
        [id, checksum, name, finished, rolledBack],
      );
      try {
        await assert.rejects(
          () => inspectStock(actor, pins),
          new RegExp(expected),
        );
      } finally {
        // Explicit cleanup of this synthetic injection only; runner never cleans history.
        await actor.query("DELETE FROM public._prisma_migrations WHERE id=$1", [
          id,
        ]);
      }
      pass(expected);
    }
    await inspectStock(actor, pins);
    await writeFile(
      join(dir, "managed-result.json"),
      JSON.stringify(
        {
          identity,
          final,
          functions,
          pins,
          localOnly: true,
          cloudApply: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await actor.end();
  }
}
