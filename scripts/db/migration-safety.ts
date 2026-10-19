import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { assertDevelopmentTarget } from "../../src/server/db/target";
import { expectedTables, expectedForcedTables } from "../backup/postgres";
export const migrationName = "202610190014_supplier_catalog";
export const limits = {
  lockMs: 3000,
  statementMs: 30000,
  transactionMs: 60000,
  childMs: 90000,
};
export class MigrationSafetyError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export function check(value: unknown, code: string): asserts value {
  if (!value) throw new MigrationSafetyError(code);
}
export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return JSON.stringify(value.map(canonical).sort());
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, canonical(v)]),
      ),
    );
  return JSON.stringify(value);
};
export const hash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export function migrationTarget(value: string | undefined, test: boolean) {
  check(process.env.NODE_ENV !== "production", "PRODUCTION_FORBIDDEN");
  check(
    !test || !!process.env.PUSULA_LOCAL_FIXTURE,
    "REMOTE_TEST_NOT_APPROVED",
  );
  const u = assertDevelopmentTarget(value, test, true);
  check(!u.hash, "TARGET_FRAGMENT_REJECTED");
  check(
    decodeURIComponent(u.username) ===
      (test ? "fixture_admin" : "neondb_owner"),
    "MIGRATION_ROLE_REJECTED",
  );
  return u;
}
export async function migrationClient(u: URL, test: boolean) {
  const ca = test
    ? undefined
    : await readFile(process.env.BACKUP_PG_SSLROOTCERT ?? "", "utf8");
  return new Client({
    host: u.hostname,
    port: Number(u.port || 5432),
    database: u.pathname.slice(1),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: test
      ? false
      : { ca, rejectUnauthorized: true, servername: u.hostname },
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    application_name: "pusula_safe_migration_audit",
  });
}
export async function migrationFiles(root = "prisma/migrations") {
  const entries = (await readdir(root, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  return Promise.all(
    entries.map(async (d) => ({
      name: d.name,
      checksum: createHash("sha256")
        .update(await readFile(`${root}/${d.name}/migration.sql`))
        .digest("hex"),
    })),
  );
}
export function validateHistory(
  rows: {
    migration_name: string;
    checksum: string;
    finished: boolean;
    rolled_back: boolean;
  }[],
  files: { name: string; checksum: string }[],
) {
  check(
    rows.every((r) => r.finished || r.rolled_back),
    "MIGRATION_UNRESOLVED",
  );
  const applied = rows.filter((r) => r.finished && !r.rolled_back);
  check(
    rows.every((r) => files.some((f) => f.name === r.migration_name)),
    "MIGRATION_UNKNOWN",
  );
  check(
    applied.every(
      (r) =>
        files.filter(
          (f) => f.name === r.migration_name && f.checksum === r.checksum,
        ).length === 1,
    ),
    "MIGRATION_CHECKSUM_REJECTED",
  );
  check(
    new Set(applied.map((r) => r.migration_name)).size === applied.length,
    "MIGRATION_DUPLICATE",
  );
  const pending = files.filter(
    (f) => !applied.some((r) => r.migration_name === f.name),
  );
  check(
    pending.length === 0 ||
      (pending.length === 1 && pending[0].name === migrationName),
    "PENDING_MIGRATION_REJECTED",
  );
  return pending.length === 0 ? "ALREADY_APPLIED" : "PENDING";
}
export async function catalog(db: Client) {
  const rows = async (sql: string) => (await db.query(sql)).rows;
  return {
    tables: await rows(
      `SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') ORDER BY 1`,
    ),
    columns: await rows(
      `SELECT c.relname AS tab,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attidentity,a.attgenerated FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`,
    ),
    constraints: await rows(
      `SELECT c.conrelid::regclass::text AS tab,c.conname,c.contype,c.convalidated,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c WHERE c.connamespace='public'::regnamespace ORDER BY 1,2`,
    ),
    indexes: await rows(
      `SELECT c.relname AS tab,i.relname AS name,x.indisvalid,x.indisready,pg_get_indexdef(x.indexrelid) AS definition FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid WHERE c.relnamespace='public'::regnamespace ORDER BY 1,2`,
    ),
    policies: await rows(
      `SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY 1,2`,
    ),
    triggers: await rows(
      `SELECT tgrelid::regclass::text AS tab,tgname,tgenabled,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) ORDER BY 1,2`,
    ),
    functions: await rows(
      `SELECT p.oid::regprocedure::text AS identity,p.prosecdef,pg_get_functiondef(p.oid) AS definition FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY 1`,
    ),
    types: await rows(
      `SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace ORDER BY 1,3`,
    ),
  };
}
export async function validateRemotePrivileges(
  db: Client,
  pinned: Record<string, string>,
) {
  await db.query("BEGIN READ ONLY");
  try {
    const queries = {
      roles: `SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,has_database_privilege(oid,current_database(),'CONNECT') AS connect,has_database_privilege(oid,current_database(),'TEMP') AS temp,has_schema_privilege(oid,'public','CREATE') AS schema_create FROM pg_roles ORDER BY 1`,
      memberships: `SELECT pg_get_userbyid(roleid) AS parent,pg_get_userbyid(member) AS member,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY 1,2`,
      defaults: `SELECT pg_get_userbyid(defaclrole) AS owner,defaclnamespace::regnamespace::text AS schema,defaclobjtype,defaclacl::text FROM pg_default_acl ORDER BY 1,2,3`,
      acl: `SELECT r.rolname,c.relname,has_table_privilege(r.oid,c.oid,'SELECT') AS select,has_table_privilege(r.oid,c.oid,'INSERT') AS insert,has_table_privilege(r.oid,c.oid,'UPDATE') AS update,has_table_privilege(r.oid,c.oid,'DELETE') AS delete,has_table_privilege(r.oid,c.oid,'TRUNCATE') AS truncate FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname LIKE 'pusula%' AND c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname NOT IN ('Supplier','SupplierMaterial','SupplierOfferVersion') ORDER BY 1,2`,
    };
    for (const [key, sql] of Object.entries(queries))
      check(
        hash((await db.query(sql)).rows) === pinned[key],
        `PRIVILEGE_DRIFT_${key.toUpperCase()}`,
      );
    check(
      !(
        await db.query(
          `SELECT has_database_privilege('pusula_test_runtime',current_database(),'CONNECT') AS allowed`,
        )
      ).rows[0].allowed,
      "TEST_DEVELOPMENT_CONNECT_REJECTED",
    );
  } finally {
    await db.query("ROLLBACK");
  }
}
export async function inspect(
  db: Client,
  files: Awaited<ReturnType<typeof migrationFiles>>,
  pinned: Record<string, string>,
  appliedPin?: Record<string, string>,
) {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const version = Number(
      (await db.query("SHOW server_version_num")).rows[0].server_version_num,
    );
    check(version >= 180000 && version < 190000, "PG18_REQUIRED");
    const history = (
      await db.query(
        `SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM _prisma_migrations ORDER BY migration_name`,
      )
    ).rows;
    const state = validateHistory(history, files);
    const current = await catalog(db);
    if (state === "PENDING") {
      check(
        canonical(current.tables.map((t) => t.relname)) ===
          canonical(expectedTables),
        "TABLE_DRIFT",
      );
      check(
        canonical(
          current.tables
            .filter((t) => t.relrowsecurity && t.relforcerowsecurity)
            .map((t) => t.relname),
        ) === canonical(expectedForcedTables),
        "RLS_DRIFT",
      );
      for (const [key, value] of Object.entries(current))
        check(hash(value) === pinned[key], `SCHEMA_DRIFT_${key.toUpperCase()}`);
    } else {
      check(
        current.tables.length === 38 &&
          current.tables.filter(
            (t) => t.relrowsecurity && t.relforcerowsecurity,
          ).length === 24,
        "APPLIED_SCHEMA_INCONSISTENT",
      );
      if (appliedPin)
        for (const [key, value] of Object.entries(current))
          check(
            hash(value) === appliedPin[key],
            `APPLIED_SCHEMA_DRIFT_${key.toUpperCase()}`,
          );
      const names = ["Supplier", "SupplierMaterial", "SupplierOfferVersion"];
      for (const name of names) {
        const acl = (
          await db.query(
            `SELECT has_table_privilege('pusula_runtime',$1,'SELECT') AS read,has_table_privilege('pusula_runtime',$1,'INSERT') AS insert,has_table_privilege('pusula_runtime',$1,'UPDATE') AS update,has_table_privilege('pusula_runtime',$1,'DELETE,TRUNCATE') AS destructive,has_table_privilege('pusula_auth',$1,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS auth,has_table_privilege('pusula_test_runtime',$1,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS test`,
            [`public."${name}"`],
          )
        ).rows[0];
        check(
          acl.read &&
            acl.insert &&
            acl.update === (name !== "SupplierOfferVersion") &&
            !acl.destructive &&
            !acl.auth &&
            !acl.test,
          "SUPPLIER_GRANTS_REJECTED",
        );
      }
      const exposed = (
        await db.query(
          `SELECT EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1::text[]) AND a.grantee=0) OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('v42_reject_offer_mutation','v42_supplier_identity_guard') AND a.grantee=0) AS exposed`,
          [names],
        )
      ).rows[0].exposed;
      check(!exposed, "SUPPLIER_PUBLIC_ACCESS_REJECTED");
    }
    const extra = (
      await db.query(
        `SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('public','information_schema')) OR EXISTS(SELECT 1 FROM pg_extension WHERE extname<>'plpgsql') OR EXISTS(SELECT 1 FROM pg_event_trigger) OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind NOT IN ('r','i')) AS unexpected`,
      )
    ).rows[0];
    check(!extra.unexpected, "EXTRA_OBJECT_DRIFT");
    return { state, current, history };
  } finally {
    await db.query("ROLLBACK");
  }
}
