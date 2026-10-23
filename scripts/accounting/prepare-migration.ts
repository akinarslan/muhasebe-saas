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
      .replace(/DO \$\$ BEGIN[\s\S]*?END \$\$;/, "")
      .replace(/^BEGIN;\r?\n|^COMMIT;\r?\n?/gm, "")
      .replaceAll("pusula_test_runtime", "pusula_runtime");
    if (
      body.includes("ACCOUNTING_LOCAL_ONLY") ||
      body.includes("fixture_admin")
    )
      throw Error("CANDIDATE_LOCAL_GUARD_REMAINS");
    bodies.push(`-- Source ${file} SHA256 ${sha(source)}\n${body}`);
  }
  const sql = `-- 017 FINANCE CANDIDATE. NOT REGISTERED FOR AUTOMATIC DEPLOY.
-- Promote byte-identically to the ONE canonical Prisma history only after accepted 016 and operator approval.
BEGIN;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='120s';
DO $$ BEGIN
 IF current_setting('pusula.finance_review',true) IS DISTINCT FROM 'APPROVED_017_CANDIDATE' THEN RAISE EXCEPTION 'FINANCE_OPERATOR_REVIEW_REQUIRED'; END IF;
 IF current_setting('server_version_num')<>'180006' OR to_regclass('public."FinanceAccount"') IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_BASELINE_REJECTED'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>16 OR NOT EXISTS(SELECT 1 FROM public._prisma_migrations WHERE migration_name='202610210016_goods_receipts' AND checksum='27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) THEN RAISE EXCEPTION 'FINANCE_ACCEPTED_016_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pusula_runtime' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb) THEN RAISE EXCEPTION 'FINANCE_RUNTIME_ROLE_REJECTED'; END IF;
END $$;
${bodies.join("\n")}
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['FinanceAccount','FinanceJournal','FinancePosting','FinanceIntent','FinanceAccountAccess','FinanceOperation','FinanceAllocation','FinanceFundMovement','FinanceExpense'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public."'||t||'"') AND relrowsecurity AND relforcerowsecurity) OR has_table_privilege('pusula_runtime',to_regclass('public."'||t||'"'),'INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'FINANCE_POST_ACL_REJECTED'; END IF;
 END LOOP;
 IF pg_has_role('pusula_runtime','pusula_finance_executor','MEMBER') THEN RAISE EXCEPTION 'FINANCE_EXECUTOR_MEMBERSHIP_REJECTED'; END IF;
END $$;
COMMIT;
`;
  return {
    sql,
    manifest: {
      candidate: "202610230017_finance",
      schemaTables: 56,
      forcedRls: 42,
      canonicalHistoryChanged: false,
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
