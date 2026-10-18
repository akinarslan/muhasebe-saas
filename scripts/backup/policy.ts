import { Client } from "pg";
import { BackupError, requireCheck } from "./core";

export const STRICT = "strict-v1" as const;
export const MANAGED = "managed-neon-candidate-v1" as const;
export type SecurityPolicy = typeof STRICT | typeof MANAGED;
export function selectPolicy(
  value: string | undefined,
  explicitManaged: boolean,
  production: boolean,
): SecurityPolicy {
  requireCheck(!production, "PRODUCTION_FORBIDDEN");
  requireCheck(
    value === undefined || value === STRICT || value === MANAGED,
    "SECURITY_POLICY_INVALID",
  );
  const policy = value ?? STRICT;
  requireCheck(
    policy !== MANAGED || explicitManaged,
    "MANAGED_POLICY_SELECTION_REQUIRED",
  );
  requireCheck(
    policy === MANAGED || !explicitManaged,
    "SECURITY_POLICY_SELECTION_MISMATCH",
  );
  return policy;
}
export const databaseAccessSql = `SELECT d.datname,
 d.datname=current_database() AS is_current,
 has_database_privilege(d.oid,'CONNECT') AS can_connect,
 EXISTS(SELECT 1 FROM aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE a.grantee=0 AND a.privilege_type='CONNECT') AS public_connect,
 EXISTS(SELECT 1 FROM aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE a.grantee=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND a.privilege_type='CONNECT') AS direct_connect
 FROM pg_database d WHERE d.datallowconn ORDER BY d.datname`;
export type DatabaseAccess = {
  datname: string;
  is_current: boolean;
  can_connect: boolean;
  public_connect: boolean;
  direct_connect?: boolean;
  objectAccess?: string;
};
export function validateDatabaseAccess(
  rows: DatabaseAccess[],
  policy: SecurityPolicy,
) {
  requireCheck(
    rows.filter((r) => r.is_current === true && r.can_connect === true)
      .length === 1,
    "DATABASE_ACCESS_METADATA_INVALID",
  );
  for (const row of rows.filter((r) => !r.is_current)) {
    requireCheck(
      typeof row.can_connect === "boolean" &&
        typeof row.public_connect === "boolean",
      "DATABASE_ACCESS_METADATA_INVALID",
    );
    requireCheck(
      !row.can_connect ||
        (policy === MANAGED &&
          row.public_connect &&
          row.direct_connect === false),
      "SOURCE_OTHER_DATABASE_CONNECT_REJECTED",
    );
  }
}
// Remote object permissions are not visible through the source database's catalogs.
// Candidate activation on real Neon remains blocked pending a separately approved
// cross-database audit/risk-acceptance protocol. A CLI flag is not such evidence.
export async function auditManagedFixtureDatabases(
  u: URL,
  rows: DatabaseAccess[],
) {
  requireCheck(
    u.hostname === "127.0.0.1" &&
      u.pathname === "/pusula_backup_fixture" &&
      u.username === "pusula_fixture_backup" &&
      u.searchParams.get("sslmode") === "disable",
    "MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED",
  );
  for (const row of rows.filter((r) => !r.is_current && r.can_connect)) {
    requireCheck(
      ["postgres", "template1", "pusula_backup_fixture_other"].includes(
        row.datname,
      ),
      "MANAGED_OTHER_DATABASE_UNREVIEWED",
    );
    const other = new URL(u);
    other.pathname = "/" + row.datname;
    const db = new Client({
      connectionString: other.toString(),
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
    });
    try {
      await db.connect();
      await db.query("BEGIN READ ONLY");
      const r = (
        await db.query(`SELECT
       has_database_privilege(current_database(),'CREATE') AS db_create,
       EXISTS(SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema' AND has_schema_privilege(oid,'CREATE')) AS schema_create,
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f') AND (has_table_privilege(c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) AS object_access,
       EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND has_function_privilege(p.oid,'EXECUTE')) AS callable_function,
       EXISTS(SELECT 1 FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND deptype='o') AS ownership,
       EXISTS(SELECT 1 FROM pg_class c WHERE c.relkind='S' AND CASE WHEN c.relkind='S' THEN has_sequence_privilege(c.oid,'SELECT,UPDATE,USAGE') ELSE false END) AS sequence_access
      `)
      ).rows[0];
      requireCheck(
        r && Object.values(r).every((v) => v === false),
        "MANAGED_OTHER_DATABASE_OBJECT_ACCESS_REJECTED",
      );
      row.objectAccess = "fixture-catalog-audited-no-user-object-access";
      await db.query("ROLLBACK");
    } finally {
      await db.end().catch(() => {});
    }
  }
}
export function requireKnownPolicy(policy: SecurityPolicy) {
  if (policy !== STRICT && policy !== MANAGED)
    throw new BackupError("SECURITY_POLICY_INVALID");
}
