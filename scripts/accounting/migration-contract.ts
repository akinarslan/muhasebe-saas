import assert from "node:assert/strict";
import type { Client } from "pg";
export const financeMigration = "202610230017_finance";
export const financeTables = [
  "FinanceAccount",
  "FinanceJournal",
  "FinancePosting",
  "FinanceIntent",
  "FinanceAccountAccess",
  "FinanceOperation",
  "FinanceAllocation",
  "FinanceFundMovement",
  "FinanceExpense",
].sort();
// Auth and every other non-owner grantee are deliberately absent.
export const runtimeFunctions = [
  "k1_command",
  "k2_post_sale",
  "k3_command",
  "k3_read",
  "k3_due",
  "k3_can_fund",
  "k3_outcome",
  "k4_expense",
].sort();
export function financeFailureState(
  phase: "before-apply" | "transaction" | "commit-sent" | "committed",
  rollbackConfirmed = false,
) {
  return phase === "before-apply"
    ? "NOT_APPLIED"
    : phase === "transaction" && rollbackConfirmed
      ? "ROLLED_BACK"
      : "REVIEW_REQUIRED";
}
export async function financeSecurity(db: Client) {
  const rows = async (sql: string) => (await db.query(sql)).rows;
  return {
    functions: await rows(
      `SELECT p.oid::regprocedure::text signature,p.proname,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) owner FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname ~ '^k[1-4]_' ORDER BY 1`,
    ),
    execute: await rows(
      `SELECT p.oid::regprocedure::text signature,p.proname,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,pg_get_userbyid(a.grantor) grantor,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='public'::regnamespace AND p.proname ~ '^k[1-4]_' ORDER BY 1,3,4`,
    ),
    role: await rows(
      `SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls FROM pg_roles WHERE rolname LIKE 'pusula_finance%' ORDER BY 1`,
    ),
    members: await rows(
      `SELECT pg_get_userbyid(roleid) parent,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option FROM pg_auth_members WHERE pg_get_userbyid(roleid) LIKE 'pusula_finance%' OR pg_get_userbyid(member) LIKE 'pusula_finance%' ORDER BY 1,2,3`,
    ),
    tables: await rows(
      `SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'Finance%' AND c.relkind='r' ORDER BY 1`,
    ),
    tableAcl: await rows(
      `SELECT c.relname,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type,a.is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'Finance%' AND c.relkind='r' ORDER BY 1,2,4`,
    ),
    columnAcl: await rows(
      `SELECT c.relname,x.attname,pg_get_userbyid(a.grantee) grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_attribute x ON x.attrelid=c.oid CROSS JOIN LATERAL aclexplode(x.attacl) a WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'Finance%' ORDER BY 1,2,3,5`,
    ),
    defaults: await rows(
      `SELECT pg_get_userbyid(defaclrole) owner,defaclnamespace::regnamespace::text ns,defaclobjtype,defaclacl::text FROM pg_default_acl ORDER BY 1,2,3`,
    ),
    schemaCreate: await rows(
      `SELECT rolname,has_schema_privilege(oid,'public','CREATE') can_create FROM pg_roles WHERE rolname IN ('pusula_finance_executor','pusula_runtime','pusula_auth') ORDER BY 1`,
    ),
  };
}
export async function acceptFinanceSecurity(
  db: Client,
  expectedFunctionNames: string[],
  expectedDefaults: unknown,
) {
  const s = await financeSecurity(db);
  assert.deepEqual(s.role, [
    {
      rolname: "pusula_finance_executor",
      rolcanlogin: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolinherit: false,
      rolreplication: false,
      rolbypassrls: false,
    },
  ]);
  assert.deepEqual(s.members, []);
  assert.deepEqual(s.defaults, expectedDefaults);
  assert.deepEqual(
    s.tables.map((t) => t.relname),
    financeTables,
  );
  for (const t of s.tables) {
    assert.equal(t.owner, "fixture_finance_owner");
    assert.equal(t.relrowsecurity, true);
    assert.equal(t.relforcerowsecurity, true);
  }
  assert.deepEqual(
    s.functions.map((f) => f.proname).sort(),
    expectedFunctionNames.sort(),
  );
  const definers = [
    "k1_command",
    "k1_command_impl",
    "k2_post_sale",
    "k2_post_sale_impl",
    "k3_command",
    "k3_outcome",
    "k4_expense",
  ];
  for (const f of s.functions) {
    assert.equal(f.owner, "pusula_finance_executor");
    assert.equal(f.prosecdef, definers.includes(f.proname));
    assert.deepEqual(f.proconfig, ["search_path=pg_catalog, public"]);
  }
  for (const f of s.functions) {
    const a = s.execute.filter((a) => a.signature === f.signature);
    assert.deepEqual(
      a.map((a) => a.grantee).sort(),
      [
        "pusula_finance_executor",
        ...(runtimeFunctions.includes(f.proname) ? ["pusula_runtime"] : []),
      ].sort(),
    );
    for (const x of a) {
      assert.equal(x.grantor, "pusula_finance_executor");
      assert.equal(x.is_grantable, false);
    }
  }
  for (const t of financeTables) {
    const a = s.tableAcl.filter(
      (a) => a.relname === t && a.grantee !== "fixture_finance_owner",
    );
    const expected = [
      "pusula_runtime:SELECT",
      "pusula_finance_executor:SELECT",
      "pusula_finance_executor:INSERT",
      ...(t === "FinanceAccountAccess"
        ? ["pusula_finance_executor:DELETE"]
        : []),
    ].sort();
    assert.deepEqual(
      a.map((a) => `${a.grantee}:${a.privilege_type}`).sort(),
      expected,
    );
    for (const x of a) {
      assert.equal(x.grantor, "fixture_finance_owner");
      assert.equal(x.is_grantable, false);
    }
  }
  assert.deepEqual(s.columnAcl, [
    {
      relname: "FinanceIntent",
      attname: "closed",
      grantee: "pusula_finance_executor",
      grantor: "fixture_finance_owner",
      privilege_type: "UPDATE",
      is_grantable: false,
    },
  ]);
  assert.ok(s.schemaCreate.every((r) => !r.can_create));
  return s;
}
