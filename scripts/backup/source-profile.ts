// Explicit release profiles; never infer the expected release from observed DB rows.
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { expectedTables, expectedForcedTables } from "./postgres";
import { requireCheck, canonical, BackupError } from "./core";
import {
  migrationChecksumMatches,
  reviewedRollbackMatches,
} from "../db/migration-checksum";

export type SourceRelease = "pre016" | "post016" | "post017";
export const releaseCounts = { pre016: 15, post016: 16, post017: 17 } as const;
const purchase = [
  "Supplier",
  "SupplierMaterial",
  "SupplierOfferVersion",
  "PurchaseOrder",
  "PurchaseOrderLine",
];
const stock = [
  "StockLocation",
  "GoodsReceipt",
  "GoodsReceiptLine",
  "StockLot",
  "StockPostingBatch",
  "StockMovement",
  "StockBalance",
];
const finance = [
  "FinanceAccount",
  "FinanceJournal",
  "FinancePosting",
  "FinanceIntent",
  "FinanceAccountAccess",
  "FinanceOperation",
  "FinanceAllocation",
  "FinanceFundMovement",
  "FinanceExpense",
];
export function sourceProfile(release: SourceRelease) {
  requireCheck(
    Object.hasOwn(releaseCounts, release),
    "BACKUP_RELEASE_REJECTED",
  );
  const added = [
    ...purchase,
    ...(release !== "pre016" ? stock : []),
    ...(release === "post017" ? finance : []),
  ];
  return {
    release,
    migrationCount: releaseCounts[release],
    tables: [...expectedTables, ...added].sort(),
    forced: [...expectedForcedTables, ...added].sort(),
  };
}
export async function profileMigrations(release: SourceRelease) {
  const entries = (await readdir("prisma/migrations", { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  requireCheck(
    entries.length === 17,
    "BACKUP_MIGRATION_INVENTORY_REVIEW_REQUIRED",
  );
  const pins = JSON.parse(
    await readFile("scripts/backup/source-profile-pins.json", "utf8"),
  ) as Record<string, string>;
  return Promise.all(
    entries.slice(0, sourceProfile(release).migrationCount).map(async (e) => {
      const sql = await readFile(
        join("prisma/migrations", e.name, "migration.sql"),
        "utf8",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      requireCheck(
        migrationChecksumMatches(e.name, pins[e.name], checksum),
        "BACKUP_SOURCE_SQL_DRIFT",
      );
      return { name: e.name, checksum, sql };
    }),
  );
}
export function validateProfileHistory(
  rows: {
    migration_name: string;
    checksum: string;
    finished_at: unknown;
    rolled_back_at: unknown;
  }[],
  files: { name: string; checksum: string }[],
) {
  const success = rows.filter((r) => r.finished_at && !r.rolled_back_at);
  const rollback = rows.filter((r) => !r.finished_at && r.rolled_back_at);
  requireCheck(
    success.length + rollback.length === rows.length,
    "MIGRATIONS_INCOMPLETE",
  );
  requireCheck(
    rollback.length <= 1 &&
      rollback.every((r) =>
        reviewedRollbackMatches(r.migration_name, r.checksum),
      ),
    "BACKUP_ROLLBACK_HISTORY_REJECTED",
  );
  requireCheck(
    success.length === files.length &&
      new Set(success.map((r) => r.migration_name)).size === files.length,
    "MIGRATIONS_INCOMPLETE",
  );
  for (const file of files) {
    const row = success.find((r) => r.migration_name === file.name);
    requireCheck(
      row && migrationChecksumMatches(file.name, file.checksum, row.checksum),
      "MIGRATION_CHECKSUM_MISMATCH",
    );
  }
}

export function profileHistoryIdentity(
  rows: {
    migration_name: string;
    checksum: string;
    finished_at: unknown;
    rolled_back_at: unknown;
  }[],
) {
  return rows
    .map((r) => [
      r.migration_name,
      r.checksum,
      Boolean(r.finished_at),
      Boolean(r.rolled_back_at),
    ])
    .sort((a, b) => canonical(a).localeCompare(canonical(b)));
}

type FunctionContract = {
  identity: string;
  body: string;
  definer: boolean;
  config: string[] | null;
  owner: string;
  language: string;
  result: string;
};
// Restricted parser for the pinned migration dialect, not arbitrary SQL.
// Expected bodies/renames come from source BEFORE any DB observation.
export function sourceFunctions(
  files: { sql: string }[],
  creator: string,
): FunctionContract[] {
  const functions = new Map<string, FunctionContract>();
  const token =
    /CREATE(?: OR REPLACE)? FUNCTION (\w+)\(([^)]*)\) RETURNS ([\s\S]*?) AS \$\$([\s\S]*?)\$\$;|ALTER FUNCTION (\w+)\(([^)]*)\) RENAME TO (\w+);/g;
  for (const { sql } of files)
    for (const m of sql.matchAll(token)) {
      if (m[5]) {
        const old = `${m[5]}(${m[6].replaceAll(" ", "")})`;
        const item = functions.get(old);
        requireCheck(item, "BACKUP_FUNCTION_RENAME_UNREVIEWED");
        functions.delete(old);
        functions.set(`${m[7]}(${m[6].replaceAll(" ", "")})`, {
          ...item,
          identity: `${m[7]}(${m[6].replaceAll(" ", "")})`,
        });
        continue;
      }
      const args = m[2].trim()
        ? m[2]
            .split(",")
            .map((a) => a.trim().split(/\s+/).at(-1))
            .join(",")
        : "";
      const header = m[3],
        name = m[1],
        definer = /SECURITY DEFINER/.test(header);
      const path = /SET search_path=([\w, ]+)/.exec(header)?.[1].trim();
      const identity = `${name}(${args})`;
      const result = header.split(/\s+LANGUAGE\s+/)[0].trim();
      functions.set(identity, {
        identity,
        body: m[4].replaceAll("\r\n", "\n"),
        definer,
        config: path
          ? [
              `search_path=${path
                .split(",")
                .map((p) => p.trim())
                .join(", ")}`,
            ]
          : null,
        owner: /^k[1-4]_/.test(name)
          ? "pusula_finance_executor"
          : definer && name.startsWith("v43b_")
            ? "pusula_stock_executor"
            : creator,
        language: /LANGUAGE (\w+)/.exec(header)![1],
        result,
      });
    }
  // 017's pinned K4 delta changes five existing bodies via seven literal
  // replacements. Interpret only that reviewed source dialect, never target output.
  let replacements = 0;
  for (const { sql } of files)
    for (const block of sql.matchAll(
      /DO \$\$ DECLARE body text; BEGIN([\s\S]*?)END \$\$;/g,
    )) {
      for (const chunk of block[1].matchAll(
        /body:=pg_get_functiondef\('([^']+)'::regprocedure\);([\s\S]*?)(?=body:=pg_get_functiondef|$)/g,
      )) {
        const item = functions.get(chunk[1]);
        requireCheck(item, "BACKUP_FUNCTION_PATCH_UNREVIEWED");
        for (const patch of chunk[2].matchAll(
          /replace\(body,\s*('(?:[^']|'')*'),\s*('(?:[^']|'')*')\)/g,
        )) {
          const literal = (s: string) => s.slice(1, -1).replaceAll("''", "'");
          const from = literal(patch[1]);
          requireCheck(
            item.body.includes(from),
            "BACKUP_FUNCTION_PATCH_SOURCE_DRIFT",
          );
          item.body = item.body.replaceAll(from, literal(patch[2]));
          replacements++;
        }
      }
    }
  requireCheck(
    replacements === (files.length === 17 ? 7 : 0),
    "BACKUP_FUNCTION_PATCH_COVERAGE_REJECTED",
  );
  return [...functions.values()].sort((a, b) =>
    a.identity.localeCompare(b.identity),
  );
}
export const profileFunctionSql = `SELECT p.oid::regprocedure::text identity,p.prosrc body,p.prosecdef definer,p.proconfig config,pg_get_userbyid(p.proowner) owner,l.lanname language,pg_get_function_result(p.oid) result,has_function_privilege(p.oid,'EXECUTE') executable,has_function_privilege(p.oid,'EXECUTE WITH GRANT OPTION') grantable FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.pronamespace='public'::regnamespace ORDER BY 1`;
export function validateProfileFunctions(
  observed: (FunctionContract & { executable: boolean; grantable: boolean })[],
  expected: FunctionContract[],
) {
  // Ignore formatting outside quoted identifiers, never spaces inside a name.
  const resultType = (s: string) =>
    (s.match(/"(?:[^"]|"")*"|'(?:[^']|'')*'|\S/g) ?? []).join("");
  requireCheck(
    observed.length === expected.length,
    "SOURCE_FUNCTION_COVERAGE_REJECTED",
  );
  for (const wanted of expected) {
    const actual = observed.find((r) => r.identity === wanted.identity);
    requireCheck(actual, "SOURCE_FUNCTION_COVERAGE_REJECTED");
    const { executable, grantable, ...definition } = actual;
    requireCheck(grantable === false, "BACKUP_FUNCTION_GRANT_OPTION_REJECTED");
    // pg_get_function_result normalizes TABLE argument spacing.
    const normalized = {
      ...definition,
      body: definition.body.replaceAll("\r\n", "\n"),
      result: resultType(definition.result),
    };
    const expectedDefinition = {
      ...wanted,
      result: resultType(wanted.result),
    };
    if (canonical(normalized) !== canonical(expectedDefinition))
      throw Object.assign(
        new BackupError("SOURCE_FUNCTION_DEFINITION_REJECTED"),
        {
          functionDrift: {
            identity: wanted.identity,
            fields: Object.keys(expectedDefinition).filter(
              (k) =>
                canonical(normalized[k as keyof typeof normalized]) !==
                canonical(
                  expectedDefinition[k as keyof typeof expectedDefinition],
                ),
            ),
          },
        },
      );
    const publicTrigger = [
      "reject_price_history_change()",
      "reject_auth_security_event_change()",
      "reject_audit_event_change()",
      "pusula_sale_child_same_transaction()",
    ].includes(wanted.identity);
    requireCheck(
      executable === publicTrigger,
      "BACKUP_FUNCTION_EXECUTE_REJECTED",
    );
  }
}

export const profileFunctionAclSql = `SELECT p.oid::regprocedure::text identity,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='public'::regnamespace ORDER BY 1,2,3`;
export const profileExecutorSql = `SELECT r.rolname,r.rolcanlogin,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,r.rolinherit,r.rolconfig,has_schema_privilege(r.oid,'public','CREATE') schema_create,EXISTS(SELECT 1 FROM pg_auth_members a WHERE a.roleid=r.oid OR a.member=r.oid) membership FROM pg_roles r WHERE r.rolname LIKE 'pusula_stock%' OR r.rolname LIKE 'pusula_finance%' ORDER BY 1`;
export function validateExecutors(rows: unknown[], release: SourceRelease) {
  const role = (rolname: string, rolinherit: boolean) => ({
    rolname,
    rolcanlogin: false,
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolreplication: false,
    rolbypassrls: false,
    rolinherit,
    rolconfig: null,
    schema_create: false,
    membership: false,
  });
  const expected =
    release === "pre016"
      ? []
      : release === "post016"
        ? [role("pusula_stock_executor", true)]
        : [
            role("pusula_finance_executor", false),
            role("pusula_stock_executor", true),
          ];
  requireCheck(
    canonical(rows) === canonical(expected),
    "BACKUP_EXECUTOR_OR_CREATOR_AUTHORITY_REJECTED",
  );
}
export function expectedFunctionAcl(
  functions: FunctionContract[],
  release: SourceRelease,
) {
  return functions.flatMap((f) => {
    const name = f.identity.split("(")[0],
      grantees = [f.owner];
    if (
      [
        "reject_price_history_change",
        "reject_auth_security_event_change",
        "reject_audit_event_change",
        "pusula_sale_child_same_transaction",
      ].includes(name)
    )
      grantees.push("PUBLIC");
    if (name === "pusula_can")
      grantees.push(
        "pusula_runtime",
        "pusula_test_runtime",
        ...(release !== "pre016" ? ["pusula_stock_executor"] : []),
        ...(release === "post017" ? ["pusula_finance_executor"] : []),
      );
    if (
      name.startsWith("v42_") ||
      name.startsWith("v43a_") ||
      [
        "v43b_command",
        "v43b_order_received",
        "v43b_receipt_outcome",
        "k1_command",
        "k2_post_sale",
        "k3_command",
        "k3_read",
        "k3_due",
        "k3_can_fund",
        "k3_outcome",
        "k4_expense",
      ].includes(name)
    )
      grantees.push("pusula_runtime");
    if (name === "v43b_net_received") grantees.push("pusula_stock_executor");
    return [...new Set(grantees)].map((grantee) => ({
      identity: f.identity,
      grantee,
      grantor: f.owner,
      privilege_type: "EXECUTE",
      is_grantable: false,
    }));
  });
}
export function validateFunctionAcl(
  rows: unknown[],
  functions: FunctionContract[],
  release: SourceRelease,
) {
  const sorted = (v: unknown[]) => v.map((r) => canonical(r)).sort();
  requireCheck(
    canonical(sorted(rows)) ===
      canonical(sorted(expectedFunctionAcl(functions, release))),
    "BACKUP_FUNCTION_ACL_GRANTOR_REJECTED",
  );
}

export const backupAclSql = `WITH actor AS (SELECT oid FROM pg_roles WHERE rolname=current_user), objects AS (
 SELECT 'table' kind,c.relname identity,c.relacl acl FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
 UNION ALL SELECT 'schema',nspname,nspacl FROM pg_namespace WHERE nspname='public'
 UNION ALL SELECT 'database',datname,datacl FROM pg_database WHERE datname=current_database()
 UNION ALL SELECT 'function',p.oid::regprocedure::text,p.proacl FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
 UNION ALL SELECT 'column',c.relname||'.'||a.attname,a.attacl FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace
 UNION ALL SELECT 'default',defaclnamespace::regnamespace::text||':'||defaclobjtype::text,defaclacl FROM pg_default_acl
 ) SELECT kind,identity,pg_get_userbyid(a.grantor) grantor,a.privilege_type,a.is_grantable FROM objects CROSS JOIN LATERAL aclexplode(acl) a WHERE a.grantee=(SELECT oid FROM actor) ORDER BY 1,2,4`;
export function validateBackupAcl(
  rows: unknown[],
  tables: string[],
  owner: string,
  database: string,
) {
  const expected = [
    ...tables.map((identity) => ({
      kind: "table",
      identity,
      grantor: owner,
      privilege_type: "SELECT",
      is_grantable: false,
    })),
    {
      kind: "schema",
      identity: "public",
      grantor: "pg_database_owner",
      privilege_type: "USAGE",
      is_grantable: false,
    },
    {
      kind: "database",
      identity: database,
      grantor: owner,
      privilege_type: "CONNECT",
      is_grantable: false,
    },
  ];
  const sort = (r: unknown[]) => r.map((x) => canonical(x)).sort();
  requireCheck(
    canonical(sort(rows)) === canonical(sort(expected)),
    "BACKUP_DIRECT_ACL_GRANTOR_REJECTED",
  );
}
