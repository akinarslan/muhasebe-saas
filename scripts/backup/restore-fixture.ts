import { Client } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { resolve, relative, isAbsolute } from "node:path";
import { expectedTables, runTool } from "./postgres";
import { canonical, requireCheck } from "./core";

const sha = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
async function tableDigests(db: Client) {
  const result: Record<string, { rows: number; sha256: string }> = {};
  for (const table of expectedTables) {
    const rows = (
      await db.query(`SELECT to_jsonb(t)::text AS row FROM public."${table}" t`)
    ).rows
      .map((r) => r.row)
      .sort();
    result[table] = { rows: rows.length, sha256: sha(rows) };
  }
  return result;
}
const catalogSqls = {
  schemas: `SELECT n.nspname,pg_get_userbyid(n.nspowner) AS owner,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public' ORDER BY 1,2,3,4`,
  columnAcl: `SELECT c.relname,x.attname,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_attribute x JOIN pg_class c ON c.oid=x.attrelid CROSS JOIN LATERAL aclexplode(x.attacl) a WHERE c.relnamespace='public'::regnamespace AND x.attnum>0 AND NOT x.attisdropped ORDER BY 1,2,3,4`,
  tables: `SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY 1`,
  constraints: `SELECT c.relname,x.conname,x.contype,pg_get_constraintdef(x.oid) AS definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid WHERE c.relnamespace='public'::regnamespace ORDER BY 1,2`,
  triggers: `SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace ORDER BY 1,2`,
  policies: `SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY 2,3`,
  functions: `SELECT p.oid::regprocedure::text AS identity,pg_get_functiondef(p.oid) AS definition FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY 1`,
  tableAcl: `SELECT c.relname,pg_get_userbyid(a.grantor) AS grantor,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY 1,2,3,4`,
  functionAcl: `SELECT p.oid::regprocedure::text AS identity,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='public'::regnamespace ORDER BY 1,2,3`,
  indexes: `SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`,
};
export async function restoreFixture(input: {
  source: Client;
  connect: (db: string, user?: string, password?: string) => Client;
  dataDirectory: string;
  directory: string;
  decrypted: string;
  pgRestore: string;
  environment: NodeJS.ProcessEnv;
  readerPassword: string;
  backupPassword: string;
  pass: (name: string) => void;
}) {
  const { source, connect, pass } = input;
  requireCheck(
    input.environment.PGHOST === "127.0.0.1" &&
      input.environment.PGDATABASE === "pusula_backup_fixture",
    "RESTORE_SOURCE_REJECTED",
  );
  const norm = (p: string) => resolve(p).replaceAll("\\", "/").toLowerCase();
  const rel = relative(resolve(".data/fixtures"), resolve(input.directory));
  requireCheck(
    !isAbsolute(rel) && /^e23-[a-f0-9-]{36}$/.test(rel),
    "RESTORE_CLUSTER_REJECTED",
  );
  requireCheck(
    /^e23-[a-f0-9-]{36}$/.test(input.directory.split(/[\\/]/).at(-1) ?? "") &&
      norm(input.dataDirectory) === norm(input.directory + "/data"),
    "RESTORE_CLUSTER_REJECTED",
  );
  requireCheck(
    norm((await source.query("SHOW data_directory")).rows[0].data_directory) ===
      norm(input.dataDirectory),
    "RESTORE_CLUSTER_REJECTED",
  );
  const name = "pusula_restore_fixture_" + randomUUID().replaceAll("-", "");
  requireCheck(
    (await source.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
      .rowCount === 0,
    "RESTORE_TARGET_ALREADY_EXISTS",
  );
  const before = await tableDigests(source);
  const catalog: Record<string, unknown> = {};
  for (const [key, sql] of Object.entries(catalogSqls))
    catalog[key] = (await source.query(sql)).rows;
  await source.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
  const oid = (
    await source.query("SELECT oid FROM pg_database WHERE datname=$1", [name])
  ).rows[0].oid;
  const target = connect(name);
  try {
    await target.connect();
    requireCheck(
      norm(
        (await target.query("SHOW data_directory")).rows[0].data_directory,
      ) === norm(input.dataDirectory),
      "RESTORE_TARGET_WRONG_CLUSTER",
    );
    requireCheck(
      (
        await target.query(
          "SELECT oid FROM pg_database WHERE datname=current_database()",
        )
      ).rows[0].oid === oid,
      "RESTORE_TARGET_IDENTITY_CHANGED",
    );
    const empty = (
      await target.query(`SELECT
     (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema') AS relations,
     (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema') AS functions,
     (SELECT count(*)::int FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema')) AS extra_schemas,
     (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema') AS types,
     (SELECT count(*)::int FROM pg_largeobject_metadata) AS large_objects`)
    ).rows[0];
    requireCheck(
      Object.values(empty).every((v) => v === 0),
      "RESTORE_TARGET_NOT_EMPTY",
    );
    pass("restore-new-target-oid-cluster-and-empty-catalog-verified");
    await runTool(
      input.pgRestore,
      [
        "--exit-on-error",
        "--single-transaction",
        "--no-password",
        "--dbname=" + name,
        input.decrypted,
      ],
      {
        ...input.environment,
        PGDATABASE: name,
        PGUSER: "fixture_admin",
        PGOPTIONS: "-c statement_timeout=120000",
      },
      120000,
    );
    pass("real-pg-restore-into-new-empty-local-database");
    const after = await tableDigests(target);
    requireCheck(
      canonical(before) === canonical(after),
      "RESTORED_ROW_OR_CONTENT_MISMATCH",
    );
    pass("restore-all-35-table-counts-and-content-hashes-match");
    const metaCounts: Record<string, number> = {};
    for (const [key, sql] of Object.entries(catalogSqls)) {
      const rows = (await target.query(sql)).rows;
      requireCheck(
        canonical(catalog[key]) === canonical(rows),
        "RESTORED_CATALOG_" + key.toUpperCase() + "_MISMATCH",
      );
      metaCounts[key] = rows.length;
    }
    pass(
      "restore-fk-index-trigger-rls-policy-function-owner-and-acl-definitions-match",
    );
    const finance = (
      await target.query(
        `SELECT count(*)::int AS n FROM "MaterialPriceHistory" h JOIN "MaterialVariant" v ON v.id=h."variantId" WHERE h."previousUsd"=1.000000 AND h."nextUsd"=1.250000 AND v."usdCost"=1.250000`,
      )
    ).rows[0].n;
    requireCheck(finance === 2, "RESTORED_USD_HISTORY_MISMATCH");
    requireCheck(
      (
        await target.query(
          `SELECT count(*)::int AS n FROM "CloudSale" WHERE "rateSnapshot"->>'usdTry'='50.000000' AND "netUsd"=5.000000 AND "totalTry"=300.00`,
        )
      ).rows[0].n === 2,
      "RESTORED_SALE_SNAPSHOT_MISMATCH",
    );
    pass("restore-usd-decimals-price-history-and-sale-snapshot-match");
    requireCheck(
      (
        await target.query(
          `SELECT count(*)::int AS n FROM "CloudSale" s JOIN "CloudSaleLine" l ON l."saleId"=s.id JOIN "CloudPaymentPlan" p ON p."saleId"=s.id JOIN "Customer" c ON c.id=s."customerId"`,
        )
      ).rows[0].n === 2,
      "RESTORED_RELATIONSHIPS_MISMATCH",
    );
    requireCheck(
      (
        await target.query(
          `SELECT count(*)::int AS n FROM "AuthUser" u JOIN "AuthAccount" a ON a."userId"=u.id JOIN "AuthSession" s ON s."userId"=u.id JOIN "AuthTwoFactor" f ON f."userId"=u.id`,
        )
      ).rows[0].n === 2,
      "RESTORED_AUTH_RELATIONSHIPS_MISMATCH",
    );
    pass("restore-customer-sale-and-synthetic-auth-relationships-match");
    const contexts = (
      await target.query('SELECT id,"tenantId" FROM "LegalEntity" ORDER BY id')
    ).rows;
    for (const context of contexts) {
      await target.query("BEGIN");
      try {
        await target.query("SET LOCAL ROLE pusula_runtime");
        await target.query(
          "SELECT set_config('app.tenant_id',$1,true),set_config('app.legal_entity_id',$2,true),set_config('app.user_id','',true)",
          [context.tenantId, context.id],
        );
        requireCheck(
          (await target.query('SELECT count(*)::int AS n FROM "Customer"'))
            .rows[0].n === 1,
          "RESTORED_RLS_SCOPE_FAILED",
        );
        requireCheck(
          (
            await target.query(
              'SELECT count(*)::int AS n FROM "Customer" WHERE "tenantId"<>$1',
              [context.tenantId],
            )
          ).rows[0].n === 0,
          "RESTORED_CROSS_TENANT_LEAK",
        );
      } finally {
        await target.query("ROLLBACK");
      }
    }
    pass("restore-runtime-rls-allows-own-tenant-and-hides-other-tenant");
    const backup = connect(name, "pusula_fixture_backup", input.backupPassword);
    await backup.connect();
    try {
      requireCheck(
        (await backup.query('SELECT count(*)::int AS n FROM "Customer"'))
          .rows[0].n === 2,
        "RESTORED_BYPASS_READ_FAILED",
      );
      try {
        await backup.query("UPDATE \"Customer\" SET name='denied'");
        throw new Error("WRITE_NOT_DENIED");
      } catch (e) {
        requireCheck(
          (e as { code: string }).code === "42501",
          "RESTORED_BACKUP_WRITE_NOT_DENIED",
        );
      }
    } finally {
      await backup.end();
    }
    pass("restore-backup-select-all-and-write-denial-preserved");
    for (const [sql, expected] of [
      ['UPDATE "MaterialPriceHistory" SET "nextUsd"=2', "23514"],
      ["UPDATE \"AuthSecurityEvent\" SET action='denied'", "P0001"],
      ["UPDATE \"CloudSaleLine\" SET description='denied'", "P0001"],
      ["UPDATE \"AuditEvent\" SET action='denied'", "P0001"],
      [
        'INSERT INTO "CloudPaymentPlan"(id,"tenantId","legalEntityId","saleId","dueDate",method,amount) SELECT gen_random_uuid(),"tenantId","legalEntityId","saleId","dueDate",method,amount FROM "CloudPaymentPlan" LIMIT 1',
        "23514",
      ],
      ['DELETE FROM "Customer"', "23503"],
    ]) {
      await target.query("BEGIN");
      try {
        try {
          await target.query(sql);
          throw new Error("CONSTRAINT_NOT_ENFORCED");
        } catch (e) {
          requireCheck(
            (e as { code: string }).code === expected,
            "RESTORED_TRIGGER_OR_FK_NOT_ENFORCED",
          );
        }
      } finally {
        await target.query("ROLLBACK");
      }
    }
    pass("restore-real-fk-append-only-auth-audit-and-sale-sealing-enforced");
    requireCheck(
      canonical(before) === canonical(await tableDigests(target)),
      "RESTORE_VALIDATION_MUTATED_DATA",
    );
    return {
      targetDatabase: name,
      targetOid: oid,
      targetInitiallyEmpty: true,
      realRestore: true,
      tableDigests: after,
      catalogCounts: metaCounts,
    };
  } finally {
    await target.end();
  }
}
