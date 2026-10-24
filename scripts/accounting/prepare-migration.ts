// Offline artifact builder. Never opens a database or reads environment credentials.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [
  "local-schema.sql",
  "k2-local-schema.sql",
  "k3-local-schema.sql",
  "k4-local-schema.sql",
];
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
export async function financeMigrationCandidate() {
  const sources = [];
  const bodies = [];
  for (const file of files) {
    const source = await readFile(`scripts/accounting/${file}`, "utf8");
    sources.push({ file, sha256: sha(source) });
    const body = source
      .replaceAll("\r\n", "\n")
      .replace(/DO \$\$ BEGIN[\s\S]*?END \$\$;/, "")
      .replace(/^BEGIN;\r?\n|^COMMIT;\r?\n?/gm, "")
      .replaceAll("pusula_test_runtime", "pusula_runtime")
      .replace(/ALTER FUNCTION [^;]+ OWNER TO pusula_finance_executor;/g, "")
      .replace(/SET LOCAL ROLE pusula_finance_executor;|RESET ROLE;/g, "")
      .replace(
        "CREATE ROLE pusula_finance_executor",
        `CREATE ROLE pusula_finance_role_creator NOLOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT pusula_finance_role_creator TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
SET LOCAL ROLE pusula_finance_role_creator;
CREATE ROLE pusula_finance_executor`,
      )
      .replace(
        "NOINHERIT NOREPLICATION NOBYPASSRLS;",
        `NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT pusula_finance_executor TO SESSION_USER WITH INHERIT FALSE, SET TRUE;
RESET ROLE;`,
      );
    if (
      body.includes("ACCOUNTING_LOCAL_ONLY") ||
      body.includes("fixture_admin")
    )
      throw Error("CANDIDATE_LOCAL_GUARD_REMAINS");
    bodies.push(`-- Source ${file} SHA256 ${sha(source)}\n${body}`);
  }
  const sql = `-- 017 FINANCE. Canonical single-history artifact; cloud apply remains disabled.
-- Local-only acceptance requires a reviewed runner. Neon needs separate authorization.
BEGIN;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='120s'; SET LOCAL transaction_timeout='180s';
SET LOCAL search_path=public,pg_temp;
DO $$ BEGIN
 IF current_setting('pusula.finance_review',true) IS DISTINCT FROM 'APPROVED_017_CANDIDATE' THEN RAISE EXCEPTION 'FINANCE_OPERATOR_REVIEW_REQUIRED'; END IF;
 IF current_setting('server_version_num')<>'180006' OR to_regclass('public."FinanceAccount"') IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_BASELINE_REJECTED'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>16 OR NOT EXISTS(SELECT 1 FROM public._prisma_migrations WHERE migration_name='202610210016_goods_receipts' AND checksum='27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) THEN RAISE EXCEPTION 'FINANCE_ACCEPTED_016_REQUIRED'; END IF;
 IF NOT has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION') OR NOT has_function_privilege(current_user,'public.pusula_can(text,uuid,uuid,uuid,text)','EXECUTE WITH GRANT OPTION') THEN RAISE EXCEPTION 'FINANCE_OWNER_GRANT_AUTHORITY_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pusula_runtime' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb) THEN RAISE EXCEPTION 'FINANCE_RUNTIME_ROLE_REJECTED'; END IF;
END $$;
${bodies.join("\n")}
-- All replacements/renames/triggers above run as the table/function creator.
-- Transfer only after final bodies exist; no REPLACE under a former owner.
GRANT CREATE ON SCHEMA public TO pusula_finance_executor;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure::text signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname ~ '^k[1-4]_' LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO pusula_finance_executor', f.signature);
 END LOOP;
END $$;
SET LOCAL ROLE pusula_finance_executor;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure::text signature,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname ~ '^k[1-4]_' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,pusula_runtime,pusula_auth', f.signature);
  IF f.proname IN ('k1_command','k2_post_sale','k3_command','k3_read','k3_due','k3_can_fund','k3_outcome','k4_expense') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO pusula_runtime', f.signature);
  END IF;
 END LOOP;
END $$;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM pusula_finance_executor;
SET LOCAL ROLE pusula_finance_role_creator;
REVOKE pusula_finance_executor FROM SESSION_USER;
RESET ROLE;
DROP ROLE pusula_finance_role_creator;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['FinanceAccount','FinanceJournal','FinancePosting','FinanceIntent','FinanceAccountAccess','FinanceOperation','FinanceAllocation','FinanceFundMovement','FinanceExpense'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public."'||t||'"') AND relrowsecurity AND relforcerowsecurity) OR has_table_privilege('pusula_runtime',to_regclass('public."'||t||'"'),'INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'FINANCE_POST_ACL_REJECTED'; END IF;
 END LOOP;
 IF pg_has_role('pusula_runtime','pusula_finance_executor','MEMBER') THEN RAISE EXCEPTION 'FINANCE_EXECUTOR_MEMBERSHIP_REJECTED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='pusula_finance_executor'::regrole OR member='pusula_finance_executor'::regrole) OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pusula_finance_role_creator') OR has_schema_privilege('pusula_finance_executor','public','CREATE') THEN RAISE EXCEPTION 'FINANCE_TEMP_AUTHORITY_REMAINS'; END IF;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname ~ '^k[1-4]_')<>16 OR EXISTS(
 SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname ~ '^k[1-4]_' AND
 (p.proowner<>'pusula_finance_executor'::regrole OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public'] OR
 p.prosecdef IS DISTINCT FROM (p.proname IN ('k1_command','k1_command_impl','k2_post_sale','k2_post_sale_impl','k3_command','k3_outcome','k4_expense')) OR has_function_privilege('pusula_auth',p.oid,'EXECUTE'))
 ) THEN RAISE EXCEPTION 'FINANCE_FUNCTION_CONTRACT_REJECTED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='public'::regnamespace AND p.proname ~ '^k[1-4]_' AND
 (a.grantor<>'pusula_finance_executor'::regrole OR a.is_grantable OR a.grantee NOT IN ('pusula_finance_executor'::regrole,'pusula_runtime'::regrole) OR
 (a.grantee='pusula_runtime'::regrole AND p.proname NOT IN ('k1_command','k2_post_sale','k3_command','k3_read','k3_due','k3_can_fund','k3_outcome','k4_expense')))) THEN RAISE EXCEPTION 'FINANCE_EXECUTE_ACL_REJECTED'; END IF;

END $$;
COMMIT;
`;
  return {
    sql,
    manifest: {
      candidate: "202610230017_finance",
      schemaTables: 56,
      forcedRls: 42,
      canonicalHistoryChanged: true,
      previousCandidateSha256:
        "3548d3291a7c5c97919d5dee7ac20369c0c7a4de6888b4d21d17d4dcf4ad27aa",
      cloudApplyEnabled: false,
      providerEvidence: "BLOCKED",
      sources,
      sha256: sha(sql),
    },
  };
}
async function main() {
  const { sql, manifest } = await financeMigrationCandidate();
  const dir = "scripts/accounting/migration-candidate";
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/017-finance.sql`, sql);
  const canonical = "prisma/migrations/202610230017_finance";
  await mkdir(canonical, { recursive: true });
  await writeFile(`${canonical}/migration.sql`, sql);
  await writeFile(
    `${dir}/manifest.json`,
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    "Finance candidate generated offline; cloud apply remains disabled.",
  );
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/prepare-migration.ts"))
  void main();
