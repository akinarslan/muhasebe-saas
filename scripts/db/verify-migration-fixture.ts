import { Client } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { main, runPrisma, inspectFailure } from "./migrate";
import {
  migrationClient,
  migrationTarget,
  migrationFiles,
  inspect,
  check,
  hash,
  catalog,
  migrationName,
  MigrationSafetyError,
} from "./migration-safety";

export async function verifyMigrationFixture(
  db: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  const envDirectory = join(dir, "migration-env");
  await mkdir(envDirectory);
  await writeFile(
    join(envDirectory, ".env.test.local"),
    `PUSULA_MIGRATION_ENV_PROBE=${env.PUSULA_LOCAL_FIXTURE}\nTEST_DIRECT_DATABASE_URL=${env.TEST_DIRECT_DATABASE_URL}\n`,
    { flag: "wx", mode: 0o600 },
  );
  const passed: { name: string; ms: number }[] = [];
  const pinned = JSON.parse(
    await readFile("scripts/db/migration-baseline.json", "utf8"),
  );
  const files = await migrationFiles();
  const sql = await readFile(
    `prisma/migrations/${migrationName}/migration.sql`,
    "utf8",
  );
  const fixtureMigrations = join(dir, "migrations");
  await cp("prisma/migrations", fixtureMigrations, { recursive: true });
  const file = join(fixtureMigrations, migrationName, "migration.sql");
  const jobEnv = { ...env, PUSULA_MIGRATION_FIXTURE_DIR: fixtureMigrations };
  const pass = (name: string, start: number) => {
    passed.push({ name, ms: Date.now() - start });
    console.log(
      JSON.stringify({
        migrationCheck: name,
        status: "PASS",
        ms: Date.now() - start,
      }),
    );
  };
  const reject = async (
    name: string,
    fn: () => Promise<unknown>,
    expected: string,
  ) => {
    const start = Date.now();
    let code = "NO_REJECTION";
    try {
      await fn();
    } catch (e) {
      code = e instanceof MigrationSafetyError ? e.code : "UNCLASSIFIED";
    }
    if (code !== expected)
      console.log(
        JSON.stringify({ migrationCheck: name, expected, actual: code }),
      );
    check(code === expected, `FIXTURE_${name}_WRONG_RESULT`);
    pass(name, start);
  };
  const resetFailure = async () => {
    const state = await inspectFailure(db);
    check(state.unresolvedMigrations === 1, "EXPECTED_FAILED_HISTORY");
    // Only failed rows created by this synthetic invocation, never migrate resolve.
    const result = await db.query(
      `DELETE FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NULL AND rolled_back_at IS NULL RETURNING id`,
      [migrationName],
    );
    check(result.rowCount === 1, "FIXTURE_RESET_REJECTED");
  };
  const insert = async (table: string, values: Record<string, unknown>) => {
    const keys = Object.keys(values);
    await db.query(
      `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
      Object.values(values),
    );
  };
  try {
    let start = Date.now();
    await inspect(db, files, pinned.schema);
    pass("baseline-schema-pin", start);
    const wrong = files.map((f) => ({
      ...f,
      checksum: f.name.endsWith("foundation") ? "0".repeat(64) : f.checksum,
    }));
    await reject(
      "wrong-checksum",
      () => inspect(db, wrong, pinned.schema),
      "MIGRATION_CHECKSUM_REJECTED",
    );
    await db.query('ALTER TABLE "Customer" ADD COLUMN synthetic_drift text');
    await reject(
      "column-drift",
      () => inspect(db, files, pinned.schema),
      "SCHEMA_DRIFT_COLUMNS",
    );
    await db.query('ALTER TABLE "Customer" DROP COLUMN synthetic_drift');
    // Seed only imaginary pre-existing business/auth/snapshot records.
    await db.query("BEGIN");
    try {
      for (let i = 0; i < 2; i++) {
        const actor = `fictional-c1-${i}`,
          tenantId = randomUUID(),
          legalEntityId = randomUUID(),
          customerId = randomUUID(),
          materialId = randomUUID(),
          variantId = randomUUID(),
          productId = randomUUID(),
          saleId = randomUUID();
        const scope = { tenantId, legalEntityId };
        const stamp = {
          fixture: true,
          usdUnitCost: "1.250000",
          usdTry: "50.000000",
        };
        await insert("AuthUser", {
          id: actor,
          name: "Imaginary User",
          email: `c1-${i}@example.invalid`,
          updatedAt: new Date(),
        });
        await insert("Tenant", { id: tenantId, name: "Imaginary Tenant" });
        await insert("LegalEntity", {
          tenantId,
          id: legalEntityId,
          name: "Imaginary Company",
        });
        await insert("Membership", {
          id: randomUUID(),
          tenantId,
          userId: actor,
        });
        await insert("Customer", {
          ...scope,
          id: customerId,
          sourceId: `c1-${i}`,
          name: "Imaginary Customer",
        });
        await insert("Material", {
          ...scope,
          id: materialId,
          name: "Imaginary Material",
          unit: "square_meter",
        });
        await insert("MaterialVariant", {
          ...scope,
          id: variantId,
          materialId,
          name: "Synthetic Variant",
          usdCost: "1.25",
          widthCm: "152",
        });
        await insert("MaterialPriceHistory", {
          ...scope,
          id: randomUUID(),
          variantId,
          previousUsd: "1",
          nextUsd: "1.25",
          actorId: actor,
        });
        await insert("CloudProduct", {
          ...scope,
          id: productId,
          createdById: actor,
          sourceId: `c1-${i}`,
          name: "Synthetic print",
          unit: "m2",
          kind: "print",
        });
        const amounts = {
          costUsd: "2.5",
          netUsd: "5",
          netTry: "250",
          vatTry: "50",
          totalTry: "300",
        };
        await insert("CloudQuote", {
          ...scope,
          ...amounts,
          id: randomUUID(),
          createdById: actor,
          customerId,
          groupId: randomUUID(),
          revision: 1,
          title: "Synthetic quote",
          idempotencyKey: randomUUID(),
          payloadHash: "a".repeat(64),
          snapshot: stamp,
        });
        await insert("CloudSale", {
          ...scope,
          ...amounts,
          id: saleId,
          createdById: actor,
          customerId,
          idempotencyKey: randomUUID(),
          payloadHash: "b".repeat(64),
          date: "2026-10-18",
          dueDate: "2026-11-18",
          currency: "TRY",
          notes: "SYNTHETIC",
          rateSnapshot: stamp,
        });
        await insert("CloudSaleLine", {
          ...scope,
          ...amounts,
          id: randomUUID(),
          saleId,
          productId,
          description: "Synthetic line",
          quantity: "2",
          widthCm: "100",
          heightCm: "100",
          discount: "0",
          vat: "20",
          snapshot: stamp,
        });
      }
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    }
    await db.query(
      `INSERT INTO "Role"(id,name) VALUES('MASTER','Synthetic Master')`,
    );
    const oldTables = [
      "AuthUser",
      "Membership",
      "Customer",
      "Material",
      "MaterialVariant",
      "MaterialPriceHistory",
      "CloudProduct",
      "CloudQuote",
      "CloudSale",
      "CloudSaleLine",
    ];
    const contents = async () => {
      const map: Record<string, string> = {};
      for (const table of oldTables)
        map[table] = hash(
          (await db.query(`SELECT to_jsonb(t) AS record FROM "${table}" t`))
            .rows,
        );
      return map;
    };
    const before = await contents();
    const preflight = await main(["--test"]);
    check(
      preflight?.status === "PREFLIGHT_PASS" &&
        preflight.reference?.counts.length === 10 &&
        preflight.reference.counts.every((row) => row.count === "2"),
      "READONLY_REFERENCE_NOT_VERIFIED",
    );
    pass("shared-env-readonly-preflight-reference", Date.now());
    let partialReport: Awaited<ReturnType<typeof inspectFailure>> | null = null;
    if (!process.argv.includes("--migration-safety-fast")) {
      const blocker = await migrationClient(
        migrationTarget(env.TEST_DIRECT_DATABASE_URL, true),
        true,
      );
      await blocker.connect();
      try {
        await reject(
          "lock-timeout-real-prisma",
          () =>
            main(["--test", "--apply"], {
              beforeApply: async () => {
                await blocker.query("BEGIN");
                await blocker.query(
                  'LOCK TABLE "LegalEntity" IN ACCESS EXCLUSIVE MODE',
                );
              },
            }),
          "MIGRATION_STOPPED_REVIEW_REQUIRED",
        );
        check(
          (await readFile(join(dir, "postgres.log"), "utf8")).includes(
            "canceling statement due to lock timeout",
          ),
          "LOCK_TIMEOUT_NOT_CONFIRMED",
        );
        check(
          (await inspectFailure(db)).supplierTables.length === 0,
          "LOCK_PARTIAL_SCHEMA",
        );
      } finally {
        await blocker.query("ROLLBACK");
        await blocker.end();
      }
      await reject(
        "unresolved-retry-blocked",
        () => inspect(db, files, pinned.schema),
        "MIGRATION_UNRESOLVED",
      );
      await resetFailure();
      await writeFile(
        file,
        sql.replace(
          "SET LOCAL transaction_timeout = '60s';",
          "SET LOCAL transaction_timeout = '60s';\nSELECT pg_sleep(31);",
        ),
      );
      await reject(
        "statement-timeout-real-prisma",
        () => runPrisma(db, jobEnv),
        "PRISMA_CHILD_FAILED",
      );
      check(
        (await readFile(join(dir, "postgres.log"), "utf8")).includes(
          "canceling statement due to statement timeout",
        ),
        "STATEMENT_TIMEOUT_NOT_CONFIRMED",
      );
      check(
        (await inspectFailure(db)).supplierTables.length === 0,
        "STATEMENT_PARTIAL_SCHEMA",
      );
      await resetFailure();
      await writeFile(
        file,
        sql.replace(
          "SET LOCAL transaction_timeout = '60s';",
          "SET LOCAL transaction_timeout = '60s';\nSELECT pg_sleep(30);",
        ),
      );
      await reject(
        "child-timeout-real-prisma",
        () => runPrisma(db, jobEnv, 4000),
        "PRISMA_CHILD_TIMEOUT",
      );
      check(
        (await inspectFailure(db)).supplierTables.length === 0,
        "CHILD_PARTIAL_SCHEMA",
      );
      await resetFailure();
      await writeFile(
        file,
        "CREATE TABLE synthetic_partial_migration(id int);\nSELECT 1/0;\n",
      );
      await reject(
        "nontransactional-partial-failure",
        () => runPrisma(db, jobEnv),
        "PRISMA_CHILD_FAILED",
      );
      check(
        (
          await db.query(
            "SELECT to_regclass('public.synthetic_partial_migration') IS NOT NULL AS found",
          )
        ).rows[0].found,
        "PARTIAL_NOT_OBSERVED",
      );
      await reject(
        "partial-retry-blocked",
        () => inspect(db, files, pinned.schema),
        "MIGRATION_UNRESOLVED",
      );
      partialReport = await inspectFailure(db);
      await writeFile(
        join(dir, "partial-failure.json"),
        JSON.stringify(partialReport, null, 2),
      );
      // Explicit local fixture reset; this is not an operational recovery recipe.
      await db.query("DROP TABLE synthetic_partial_migration");
      await resetFailure();
      await writeFile(file, sql);
      await inspect(db, files, pinned.schema);
    }
    start = Date.now();
    await runPrisma(db, env);
    pass("normal-real-prisma-014", start);
    check(hash(before) === hash(await contents()), "EXISTING_RECORD_CHANGED");
    pass("ten-table-two-tenant-auth-financial-content-preserved", Date.now());
    const postCatalog = await catalog(db);
    await writeFile(
      join(dir, "post-schema.json"),
      JSON.stringify(
        Object.fromEntries(
          Object.entries(postCatalog).map(([key, value]) => [key, hash(value)]),
        ),
        null,
        2,
      ),
    );
    check(
      (await inspect(db, files, pinned.schema, pinned.appliedSchema)).state ===
        "ALREADY_APPLIED",
      "POSTFLIGHT_NOT_APPLIED",
    );
    start = Date.now();
    await main(["--test", "--apply"]);
    check(
      process.env.PUSULA_MIGRATION_ENV_PROBE === env.PUSULA_LOCAL_FIXTURE,
      "REAL_ENV_LOADER_NOT_EXECUTED",
    );
    pass("actual-next-env-loader-private-fixture", Date.now());
    pass("already-applied-no-replay", start);
    const rights = (
      await db.query(
        `SELECT has_table_privilege('pusula_test_runtime','"Supplier"','SELECT') AS test,has_table_privilege('pusula_auth','"Supplier"','SELECT') AS auth,has_table_privilege('pusula_runtime','"Supplier"','DELETE,TRUNCATE') AS destructive`,
      )
    ).rows[0];
    check(
      !rights.test && !rights.auth && !rights.destructive,
      "NEW_GRANTS_TOO_WIDE",
    );
    pass("no-test-or-auth-supplier-grants", Date.now());
    check(
      (
        await db.query(
          `SELECT count(*)::int AS n FROM "RolePermission" WHERE "roleId"='MASTER' AND "permissionId" LIKE 'supplier%'`,
        )
      ).rows[0].n === 8,
      "MASTER_PERMISSION_EFFECT_WRONG",
    );
    pass("eight-master-permissions-explicitly-observed", Date.now());
    let tls: unknown = null;
    if (process.argv.includes("--fixture-tls")) {
      const { verifyMigrationTls } = await import("./verify-migration-tls");
      tls = await verifyMigrationTls(db, env, dir);
      pass("real-prisma-ca-and-hostname-tls", Date.now());
    }
    await writeFile(
      join(dir, "migration-safety.json"),
      JSON.stringify(
        {
          status: "PASS",
          tls,
          checks: passed,
          partialReport,
          sourceSha256: createHash("sha256").update(sql).digest("hex"),
          existingRecordHashes: before,
        },
        null,
        2,
      ),
    );
    return { status: "PASS", checks: passed };
  } catch (e) {
    console.log(
      JSON.stringify({
        fixtureFailureType: e instanceof Error ? e.name : "UNKNOWN",
        frames:
          e instanceof Error
            ? e.stack
                ?.split("\n")
                .filter((line) => /^\s+at .*\.(ts|js):\d+:\d+/.test(line))
                .slice(0, 2)
            : [],
      }),
    );
    throw e;
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}
