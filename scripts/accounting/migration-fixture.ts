// No CLI, env loader, provider client or backup/restore. Invoked by the guarded cluster harness.
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import { catalog, hash, migrationFiles } from "../db/migration-safety";
import { reviewedRollback008 } from "../db/migration-checksum";
import { localIdentity } from "../stock/migrate";
import {
  financeMigration,
  financeTables,
  financeFailureState,
  financeSecurity,
  acceptFinanceSecurity,
} from "./migration-contract";

export async function verifyFinanceMigration(
  admin: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    return await runFinanceFixture(admin, env, dir);
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}
async function runFinanceFixture(
  admin: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
) {
  await localIdentity(admin, env);
  const results: string[] = [];
  const pass = (name: string) => {
    results.push(name);
    console.log(JSON.stringify({ finance017Check: name, status: "PASS" }));
  };
  const sql = await readFile(
    `prisma/migrations/${financeMigration}/migration.sql`,
    "utf8",
  );
  const candidate = await readFile(
    "scripts/accounting/migration-candidate/017-finance.sql",
    "utf8",
  );
  assert.equal(sql, candidate);
  const checksum = createHash("sha256").update(sql).digest("hex");
  const manifest = JSON.parse(
    await readFile(
      "scripts/accounting/migration-candidate/manifest.json",
      "utf8",
    ),
  );
  assert.equal(checksum, manifest.sha256);
  // Capture a contract BEFORE canonical apply by replaying the archived reviewed
  // K1-K4 DDL inside a rollback-only transaction. Never enroll target post output.
  const reference = await readFile(
    "scripts/accounting/migration-candidate/history/017-finance-k5.sql",
    "utf8",
  );
  assert.equal(
    createHash("sha256").update(reference).digest("hex"),
    manifest.previousCandidateSha256,
  );
  await admin.query(
    "SELECT set_config('pusula.finance_review','APPROVED_017_CANDIDATE',false)",
  );
  let expected: Awaited<ReturnType<typeof catalog>>;
  try {
    await admin.query(
      reference.replaceAll("\r\n", "\n").replace(/COMMIT;\s*$/, ""),
    );
    expected = await catalog(admin);
  } finally {
    await admin.query("ROLLBACK");
    await admin.query("RESET pusula.finance_review");
  }
  assert.equal(
    (await admin.query(`SELECT to_regclass('public."FinanceAccount"') t`))
      .rows[0].t,
    null,
  );
  const functionNames = expected.functions
    .filter((f) => /^k[1-4]_/.test(f.identity))
    .map((f) => f.identity.split("(")[0]);
  assert.equal(new Set(functionNames).size, functionNames.length);
  pass(
    "independent-reviewed-k1-k4-schema-contract-before-target-apply-rolled-back",
  );
  const password = randomBytes(32).toString("hex");
  await admin.query(
    `CREATE ROLE fixture_finance_owner LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB CREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`,
  );
  // Fixture provisioning is separate from candidate DDL. The actor owns baseline
  // objects but is not a superuser or a member of either executor.
  await admin.query("ALTER SCHEMA public OWNER TO fixture_finance_owner");
  for (const r of (
    await admin.query(
      `SELECT oid::regclass::text name FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`,
    )
  ).rows)
    await admin.query(`ALTER TABLE ${r.name} OWNER TO fixture_finance_owner`);
  for (const r of (
    await admin.query(
      `SELECT oid::regprocedure::text name FROM pg_proc WHERE pronamespace='public'::regnamespace AND proowner='fixture_admin'::regrole`,
    )
  ).rows)
    await admin.query(
      `ALTER FUNCTION ${r.name} OWNER TO fixture_finance_owner`,
    );
  await admin.query(
    `INSERT INTO _prisma_migrations(id,checksum,migration_name,rolled_back_at,applied_steps_count) VALUES($1,$2,'202610160008_company_metadata',now(),0)`,
    [randomUUID(), reviewedRollback008],
  );
  const historyBefore = (
    await admin.query("SELECT * FROM _prisma_migrations ORDER BY id")
  ).rows;
  const baseUrl = new URL(env.TEST_DIRECT_DATABASE_URL!);
  baseUrl.username = "fixture_finance_owner";
  baseUrl.password = password;
  const actor = new Client({ connectionString: baseUrl.toString() });
  await actor.connect();
  const notices: string[] = [];
  actor.on("notice", (n) => {
    if (n.code?.startsWith("01")) notices.push(n.code);
  });
  const beforeCatalog = hash(await catalog(admin));
  const beforeSecurity = await financeSecurity(admin);
  const roleSnapshot = async () =>
    (
      await admin.query(
        `SELECT rolname,rolsuper,rolcanlogin,rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles ORDER BY 1`,
      )
    ).rows;
  const members = async () =>
    (
      await admin.query(
        `SELECT pg_get_userbyid(roleid) parent,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY 1,2,3`,
      )
    ).rows;
  const rolesBefore = await roleSnapshot(),
    membersBefore = await members();
  const unchanged = async () => {
    assert.equal(hash(await catalog(admin)), beforeCatalog);
    assert.deepEqual(await financeSecurity(admin), beforeSecurity);
    assert.deepEqual(await roleSnapshot(), rolesBefore);
    assert.deepEqual(await members(), membersBefore);
    assert.deepEqual(
      (await admin.query("SELECT * FROM _prisma_migrations ORDER BY id")).rows,
      historyBefore,
    );
  };
  const failure = async (text: string) => {
    await assert.rejects(() => actor.query(text));
    await actor.query("ROLLBACK");
    await unchanged();
  };
  try {
    const identity = (
      await actor.query(
        `SELECT current_user actor,session_user session_actor,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,current_setting('createrole_self_grant') self_grant,current_setting('server_version_num') version FROM pg_roles WHERE rolname=current_user`,
      )
    ).rows[0];
    assert.deepEqual(identity, {
      actor: "fixture_finance_owner",
      session_actor: "fixture_finance_owner",
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: false,
      rolcreaterole: true,
      self_grant: "",
      version: "180006",
    });
    await failure(sql);
    pass("review-marker-required-no-schema-role-history-change");
    await actor.query(
      "SELECT set_config('pusula.finance_review','APPROVED_017_CANDIDATE',false)",
    );
    await failure(
      sql.replace(
        "GRANT CREATE ON SCHEMA public TO pusula_finance_executor;",
        "",
      ),
    );
    await failure(
      sql.replace(
        "GRANT pusula_finance_executor TO SESSION_USER WITH INHERIT FALSE, SET TRUE;",
        "",
      ),
    );
    await failure(sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;"));
    pass(
      "missing-schema-create-missing-set-and-late-error-full-transactional-rollback",
    );
    // Run the exact canonical bytes as a real non-superuser, then rollback. This
    // lets the PG client reject ineffective ACL warnings even if Prisma hides them.
    notices.length = 0;
    await actor.query(sql.replace(/COMMIT;\s*$/, ""));
    assert.deepEqual(notices, []);
    await acceptFinanceSecurity(actor, functionNames, beforeSecurity.defaults);
    assert.deepEqual(await catalog(actor), expected);
    await actor.query("ROLLBACK");
    await unchanged();
    pass(
      "exact-canonical-nonsuperuser-warning-free-dry-run-independent-catalog-and-acl",
    );
    await actor.query("RESET pusula.finance_review");
    baseUrl.searchParams.set(
      "options",
      "-c pusula.finance_review=APPROVED_017_CANDIDATE",
    );
    const childEnv: NodeJS.ProcessEnv = {
      ...env,
      PUSULA_FINANCE_LOCAL_URL: baseUrl.toString(),
      PUSULA_FINANCE_017_FIXTURE: "1",
    };
    const prisma = async (args: string[], label: string) =>
      new Promise<void>((accept, reject) => {
        const child = spawn(
          process.execPath,
          [
            "node_modules/prisma/build/index.js",
            ...args,
            "--config",
            "prisma-finance-local.config.ts",
          ],
          {
            env: {
              ...childEnv,
              ...(label === "failure"
                ? { PUSULA_FINANCE_FAILURE_FIXTURE: "1" }
                : {}),
            },
            windowsHide: true,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let output = "";
        const timer = setTimeout(() => child.kill(), 180000);
        const collect = (b: Buffer) => {
          output = (output + b.toString()).slice(-131072);
        };
        child.stdout.on("data", collect);
        child.stderr.on("data", collect);
        child.once("error", () => {
          clearTimeout(timer);
          reject(Error("FINANCE_PRISMA_CHILD_UNAVAILABLE"));
        });
        child.once("close", async (code) => {
          clearTimeout(timer);
          output = output
            .replaceAll(password, "[redacted]")
            .replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, "[local-connection]");
          await writeFile(join(dir, `finance017-${label}.log`), output);
          if (
            (code === 0 && label !== "failure") ||
            (typeof code === "number" && code > 0 && label === "failure")
          )
            accept();
          else reject(Error(`FINANCE_PRISMA_${label.toUpperCase()}_FAILED`));
        });
      });
    // Real Prisma failure uses a private phase copy with a late SQL error.
    // This is explicit fixture injection; the runner never resolves failed history.
    const failureRoot = join(dir, "finance-failure-migrations");
    for (const f of await migrationFiles()) {
      await mkdir(join(failureRoot, f.name), { recursive: true });
      await writeFile(
        join(failureRoot, f.name, "migration.sql"),
        f.name === financeMigration
          ? sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;")
          : await readFile(`prisma/migrations/${f.name}/migration.sql`),
      );
    }
    await copyFile(
      "prisma/migrations/migration_lock.toml",
      join(failureRoot, "migration_lock.toml"),
    );
    await prisma(["migrate", "deploy"], "failure");
    assert.equal(hash(await catalog(admin)), beforeCatalog);
    assert.deepEqual(await financeSecurity(admin), beforeSecurity);
    assert.deepEqual(await roleSnapshot(), rolesBefore);
    assert.deepEqual(await members(), membersBefore);
    const failed = (
      await admin.query(
        "SELECT id FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NULL AND rolled_back_at IS NULL",
        [financeMigration],
      )
    ).rows;
    assert.equal(failed.length, 1);
    await writeFile(
      join(dir, "finance017-failure-classification.json"),
      JSON.stringify({
        state: financeFailureState("transaction", true),
        schemaRolledBack: true,
        rolesRolledBack: true,
        unresolvedHistoryRows: 1,
        automaticResolve: false,
        fixtureOnlyCleanup: true,
      }),
    );
    await admin.query("DELETE FROM _prisma_migrations WHERE id=$1", [
      failed[0].id,
    ]);
    await unchanged();
    pass(
      "real-prisma-late-error-atomic-schema-role-rollback-unresolved-history-review-no-auto-resolve",
    );
    await prisma(["migrate", "deploy"], "deploy");
    const history = (
      await admin.query("SELECT * FROM _prisma_migrations ORDER BY id")
    ).rows;
    assert.equal(
      history.filter((r) => r.finished_at && !r.rolled_back_at).length,
      17,
    );
    assert.equal(
      history.filter(
        (r) =>
          r.migration_name === financeMigration &&
          r.finished_at &&
          r.checksum === checksum,
      ).length,
      1,
    );
    for (const r of historyBefore)
      assert.deepEqual(
        history.find((h) => h.id === r.id),
        r,
      );
    assert.deepEqual(await catalog(actor), expected);
    const security = await acceptFinanceSecurity(
      actor,
      functionNames,
      beforeSecurity.defaults,
    );
    const counts = (
      await admin.query(
        `SELECT count(*)::int tables,count(*) FILTER(WHERE relforcerowsecurity)::int forced FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`,
      )
    ).rows[0];
    assert.deepEqual(counts, { tables: 56, forced: 42 });
    pass(
      "real-prisma-deploy-history17-resolved008-preserved-56-tables-42-force-rls",
    );
    await prisma(["migrate", "deploy"], "repeat");
    assert.deepEqual(
      (await admin.query("SELECT * FROM _prisma_migrations ORDER BY id")).rows,
      history,
    );
    await assert.rejects(() => actor.query("SET ROLE pusula_finance_executor"));
    const runtimeUrl = new URL(env.TEST_DATABASE_URL!);
    const runtime = new Client({ connectionString: runtimeUrl.toString() });
    await runtime.connect();
    try {
      for (const t of financeTables)
        for (const command of [
          `INSERT INTO "${t}" DEFAULT VALUES`,
          `UPDATE "${t}" SET id=id`,
          `DELETE FROM "${t}"`,
          `TRUNCATE "${t}"`,
        ])
          await assert.rejects(() => runtime.query(command), { code: "42501" });
      await assert.rejects(
        () => runtime.query("SET ROLE pusula_finance_executor"),
        { code: "42501" },
      );
    } finally {
      await runtime.end();
    }
    const effective = (
      await admin.query(
        `SELECT r.rolname,p.proname FROM pg_roles r CROSS JOIN pg_proc p WHERE NOT r.rolsuper AND p.pronamespace='public'::regnamespace AND p.proname ~ '^k[1-4]_' AND has_function_privilege(r.oid,p.oid,'EXECUTE') ORDER BY 1,2`,
      )
    ).rows;
    assert.ok(
      effective.every(
        (r) =>
          r.rolname === "pusula_finance_executor" ||
          r.rolname === "pusula_runtime",
      ),
    );
    assert.equal(effective.length, 24);
    assert.deepEqual(await members(), membersBefore);
    // Negative ACL drift must fail acceptance; expected values remain immutable.
    await admin.query("BEGIN");
    try {
      await admin.query(
        "GRANT EXECUTE ON FUNCTION k1_command(text,jsonb) TO pusula_auth",
      );
      await assert.rejects(() =>
        acceptFinanceSecurity(admin, functionNames, beforeSecurity.defaults),
      );
    } finally {
      await admin.query("ROLLBACK");
    }
    for (const mutation of [
      'ALTER TABLE "FinanceJournal" DISABLE ROW LEVEL SECURITY',
      "ALTER FUNCTION k1_command(text,jsonb) SECURITY INVOKER",
      "GRANT pusula_finance_executor TO pusula_auth",
    ]) {
      await admin.query("BEGIN");
      try {
        await admin.query(mutation);
        await assert.rejects(() =>
          acceptFinanceSecurity(admin, functionNames, beforeSecurity.defaults),
        );
      } finally {
        await admin.query("ROLLBACK");
      }
    }
    for (const mutation of [
      "DROP INDEX finance_statement",
      'ALTER TABLE "FinancePosting" DROP CONSTRAINT "FinancePosting_check"',
    ]) {
      await admin.query("BEGIN");
      try {
        await admin.query(mutation);
        assert.notDeepEqual(await catalog(admin), expected);
      } finally {
        await admin.query("ROLLBACK");
      }
    }
    pass(
      "effective-execute-all-nonsuper-roles-and-rls-owner-membership-index-constraint-drift-negatives",
    );
    assert.equal(financeFailureState("before-apply"), "NOT_APPLIED");
    assert.equal(financeFailureState("transaction", true), "ROLLED_BACK");
    assert.equal(financeFailureState("transaction"), "REVIEW_REQUIRED");
    assert.equal(financeFailureState("commit-sent", true), "REVIEW_REQUIRED");
    assert.equal(financeFailureState("committed"), "REVIEW_REQUIRED");
    pass(
      "already-applied-no-second-history-runtime-dml-truncate-set-denied-acl-drift-rejected-ambiguous-commit-review",
    );
    // Expose only scoped runtime privileges to the preexisting fixture role.
    await admin.query("GRANT pusula_runtime TO pusula_test_runtime");
    await prisma(["db", "pull", "--print"], "introspection");
    await prisma(
      [
        "migrate",
        "diff",
        "--from-config-datasource",
        "--to-schema",
        "prisma/schema.prisma",
        "--script",
      ],
      "model-diff",
    );
    const modelDiff = await readFile(
      join(dir, "finance017-model-diff.log"),
      "utf8",
    );
    assert.ok(
      !/DROP (FUNCTION|POLICY|TRIGGER)|DISABLE ROW LEVEL|NO FORCE ROW/i.test(
        modelDiff,
      ),
    );
    assert.ok(
      !/Finance/.test(modelDiff),
      "Prisma diff must not propose any Finance object modification",
    );
    assert.deepEqual(await catalog(actor), expected);
    pass(
      "prisma-nine-models-relations-partial-index-diff-no-finance-ddl-no-catalog-change",
    );
    const probe = randomUUID();
    await actor.query("BEGIN");
    await actor.query("SELECT set_config('app.tenant_id',$1,true)", [probe]);
    await actor.query('INSERT INTO "Tenant"(id,name) VALUES($1,$2)', [
      probe,
      "017 commit response probe",
    ]);
    // Deliberately discard the real COMMIT reply, emulating a lost response.
    await actor.query("COMMIT");
    assert.equal(financeFailureState("commit-sent"), "REVIEW_REQUIRED");
    assert.equal(
      (
        await admin.query('SELECT count(*)::int n FROM "Tenant" WHERE id=$1', [
          probe,
        ])
      ).rows[0].n,
      1,
    );
    await admin.query('DELETE FROM "Tenant" WHERE id=$1', [probe]);
    pass(
      "real-commit-discarded-response-independent-durability-check-no-auto-retry",
    );
    const evidence = {
      status: "M017_LOCAL_PASS",
      checksum,
      identity,
      counts,
      historySuccessful: 17,
      resolved008: reviewedRollback008,
      aclWarnings: notices,
      expectedCatalogOrigin:
        "archived-reviewed-K1-K4-rollback-before-canonical-apply",
      expectedCatalogHash: hash(expected),
      actualCatalogHash: hash(await catalog(actor)),
      security,
      results,
      neonOperations: false,
      restoreOperations: false,
      r2Operations: false,
    };
    await writeFile(
      join(dir, "finance017-verification.json"),
      JSON.stringify(evidence, null, 2),
    );
    return { status: "M017_LOCAL_PASS", checksum, checks: results.length };
  } catch (error) {
    await writeFile(
      join(dir, "finance017-error.log"),
      String(error instanceof Error ? error.stack : error).replaceAll(
        password,
        "[redacted]",
      ),
    );
    throw error;
  } finally {
    await actor.query("ROLLBACK").catch(() => {});
    await actor.end();
  }
}
