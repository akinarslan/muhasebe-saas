import { createHash } from "node:crypto";
import { canonical, requireCheck } from "./core";
import {
  STRICT,
  MANAGED,
  type SecurityPolicy,
  requireKnownPolicy,
} from "./policy";

// Reviewed PG18 function definitions from the 13 checked-in migrations.
// Any definition/signature change requires a fresh source review, not automatic enrollment.
export const expectedFunctions: Record<string, string> = {
  "pusula_can(text,uuid,uuid,uuid,text)":
    "8f8efb6c29c49f1f6b811bf1d9c7ce4d56b454764ea5e560aa6560d65713d0bc",
  "pusula_sale_child_same_transaction()":
    "039c62189d4e52455015e609f0af19f78adb35d1a8feb37ad06d1a0f50d56c37",
  "reject_audit_event_change()":
    "0d3ef7da21b8767f45beff7f068491e4056a14487d45b9feac9e0ce27387aed5",
  "reject_auth_security_event_change()":
    "0ff0364de55479b77a565625928add8c2806b0e94a9c9955d0fea76c78b22e18",
  "reject_price_history_change()":
    "54a78aef7c571c29bc3e6333c4e9a3795081936bed858b6d960b34935c11588a",
};

// A dedicated backup login must have no memberships at all. This deliberately
// rejects even benign grants: SET/INHERIT/ADMIN chains cannot become an escape.
export const securitySql = `SELECT
 has_database_privilege(current_database(),'TEMP') AS database_temp,
 EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database() AND a.grantee=0 AND a.privilege_type='TEMPORARY') AS public_temp,
 EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database() AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND a.privilege_type='TEMPORARY') AS direct_temp,
 EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS role_membership,
 EXISTS(SELECT 1 FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND deptype='o') AS object_owner,
 EXISTS(SELECT 1 FROM pg_namespace WHERE nspname<>'public' AND nspname<>'information_schema' AND nspname !~ '^pg_') AS extra_schema,
 EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind NOT IN ('r','i','I','t')) AS extra_relation,
 EXISTS(SELECT 1 FROM pg_largeobject_metadata) AS large_objects,
 EXISTS(SELECT 1 FROM pg_extension WHERE extname<>'plpgsql') AS extra_extension,
 EXISTS(SELECT 1 FROM pg_event_trigger) AS event_trigger,
 EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typrelid=0 AND t.typelem=0 AND NOT (t.typtype='e' AND t.typname IN ('CostUnit','ScopeKind','PermissionEffect'))) AS extra_type,
 EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(c.oid,a.attnum,'INSERT,UPDATE,REFERENCES')) AS column_write,
 EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND has_table_privilege(c.oid,'SELECT WITH GRANT OPTION')) AS select_grant_option`;

export const functionSql = `SELECT p.oid::regprocedure::text AS identity,
 p.prosecdef AS security_definer,pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' ORDER BY 1`;

export function validateSourceSecurity(
  row: Record<string, unknown> | undefined,
  policy: SecurityPolicy = STRICT,
) {
  requireKnownPolicy(policy);
  requireCheck(
    row &&
      (row.database_temp === false ||
        (policy === MANAGED &&
          row.database_temp === true &&
          row.public_temp === true &&
          row.direct_temp === false)),
    "SOURCE_TEMP_PRIVILEGE_REJECTED",
  );
  requireCheck(
    row.role_membership === false,
    "SOURCE_ROLE_MEMBERSHIP_REJECTED",
  );
  requireCheck(row.object_owner === false, "SOURCE_OBJECT_OWNER_REJECTED");
  for (const key of [
    "extra_schema",
    "extra_relation",
    "large_objects",
    "extra_extension",
    "event_trigger",
    "extra_type",
    "column_write",
    "select_grant_option",
  ])
    requireCheck(row[key] === false, "SOURCE_OBJECT_OR_PRIVILEGE_REJECTED");
}

export function validateFunctions(
  rows: { identity: string; security_definer: boolean; definition: string }[],
) {
  requireCheck(
    canonical(rows.map((r) => r.identity).sort()) ===
      canonical(Object.keys(expectedFunctions).sort()),
    "SOURCE_FUNCTION_COVERAGE_REJECTED",
  );
  requireCheck(
    rows.every(
      (r) =>
        r.security_definer === false &&
        createHash("sha256").update(r.definition).digest("hex") ===
          expectedFunctions[r.identity],
    ),
    "SOURCE_FUNCTION_DEFINITION_REJECTED",
  );
}
