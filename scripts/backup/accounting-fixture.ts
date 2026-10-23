// Synthetic accounting coverage ONLY. The remote 35/21 source policy stays fail-closed.
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Client } from "pg";
import { requireLocalAccounting } from "../../src/server/cloud/business/accounting/accounts";
import { runTool, pgEnvironment, validateToc, validateRole } from "./postgres";
import {
  canonical,
  newContext,
  sealFile,
  saveManifest,
  verifyFile,
  digestFile,
} from "./core";
import { decryptToPrivateFile } from "./decrypt";
import { restrict } from "./workspace";
import { catalogSqls } from "./restore-fixture";

import { accountingTables } from "./accounting-coverage";
const sha = (v: unknown) =>
  createHash("sha256").update(canonical(v)).digest("hex");
async function snapshot(db: Client) {
  const tables: Record<string, unknown> = {},
    catalog: Record<string, unknown> = {};
  for (const t of accountingTables) {
    const rows = (
      await db.query(`SELECT to_jsonb(t)::text row FROM public."${t}" t`)
    ).rows
      .map((r) => r.row)
      .sort();
    tables[t] = { rows: rows.length, sha256: sha(rows) };
  }
  for (const [key, sql] of Object.entries(catalogSqls))
    catalog[key] = (await db.query(sql)).rows;
  catalog.defaultAcl = (
    await db.query(
      `SELECT pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'') schema,d.defaclobjtype kind,d.defaclacl::text acl FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace ORDER BY 1,2,3`,
    )
  ).rows;
  const reconciliation = (
    await db.query(`SELECT
    (SELECT count(*)::int FROM (SELECT "journalId" FROM "FinancePosting" GROUP BY "journalId" HAVING sum(debit-credit)<>0) q) unbalanced,
    (SELECT count(*)::int FROM "FinanceAccount" a WHERE a.kind IN ('CASH','BANK','POS') AND coalesce((SELECT sum(p.debit-p.credit) FROM "FinancePosting" p WHERE p."accountId"=a.id),0)<>coalesce((SELECT sum(m.amount) FROM "FinanceFundMovement" m WHERE m."accountId"=a.id),0)) fund_mismatches,
    (SELECT count(*)::int FROM "FinanceExpense" x JOIN "FinanceOperation" o ON o.id=x."operationId" WHERE o."journalId"<>x."journalId" OR o.amount<>x.net+x.vat) expense_mismatches`)
  ).rows[0];
  assert.deepEqual(reconciliation, {
    unbalanced: 0,
    fund_mismatches: 0,
    expense_mismatches: 0,
  });
  return { tables, catalog, reconciliation };
}
type ConstraintRow = {
  relname: string;
  conname: string;
  contype: string;
  definition: string;
};
// pg_dump deparse/reparse can fold nested AND and array coercions in old CHECKs.
// Use the SAME PG18.6 parser and identical column types, never textual erasure.
async function roundTripChecks(db: Client, rows: ConstraintRow[]) {
  const schema = `k5_compare_${randomUUID().replaceAll("-", "")}`,
    created = new Set<string>(),
    normalized: ConstraintRow[] = [],
    changed: string[] = [];
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
  await db.query(`CREATE SCHEMA ${schema}`);
  try {
    for (const row of rows) {
      if (row.contype !== "c") {
        normalized.push(row);
        continue;
      }
      assert(accountingTables.includes(row.relname));
      if (!created.has(row.relname)) {
        await db.query(
          `CREATE TABLE ${schema}.${quote(row.relname)} (LIKE public.${quote(row.relname)} INCLUDING DEFAULTS)`,
        );
        created.add(row.relname);
      }
      await db.query(
        `ALTER TABLE ${schema}.${quote(row.relname)} ADD CONSTRAINT ${quote(row.conname)} ${row.definition}`,
      );
      const definition = (
        await db.query(
          `SELECT pg_get_constraintdef(c.oid) definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relname=$2 AND c.conname=$3`,
          [schema, row.relname, row.conname],
        )
      ).rows[0].definition;
      if (definition !== row.definition)
        changed.push(`${row.relname}.${row.conname}`);
      normalized.push({ ...row, definition });
    }
  } finally {
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
  }
  return { normalized, changed };
}
export async function accountingBackupFixture() {
  requireLocalAccounting();
  const u = new URL(process.env.TEST_DIRECT_DATABASE_URL!);
  assert.equal(u.hostname, "127.0.0.1");
  assert.equal(u.pathname, "/pusula_sprint_b_test");
  assert.equal(decodeURIComponent(u.username), "fixture_admin");
  const dir = resolve(`.data/fixtures/v42-${process.env.PUSULA_LOCAL_FIXTURE}`);
  const marker = JSON.parse(await readFile(join(dir, "target.json"), "utf8"));
  assert.equal(marker.port, Number(u.port));
  const admin = new Client({ connectionString: u.toString() });
  await admin.connect();
  const password = randomBytes(32).toString("hex"),
    key = randomBytes(32),
    role = "pusula_k5_backup";
  let decrypted: string | undefined;
  const backupDir = join(dir, "k5-backup"),
    copyDir = resolve(`.data/k5-independent-copy/${randomUUID()}`);
  await mkdir(backupDir);
  await restrict(backupDir);
  await mkdir(copyDir, { recursive: true });
  await restrict(copyDir);
  try {
    assert.equal(
      (await admin.query("SHOW server_version_num")).rows[0].server_version_num,
      "180006",
    );
    assert.equal(
      resolve(
        (await admin.query("SHOW data_directory")).rows[0].data_directory,
      ).toLowerCase(),
      resolve(marker.dataDirectory).toLowerCase(),
    );
    await admin.query(
      `CREATE ROLE ${role} LOGIN PASSWORD '${password}' BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; ALTER ROLE ${role} SET default_transaction_read_only=on; GRANT CONNECT ON DATABASE pusula_sprint_b_test TO ${role}; GRANT USAGE ON SCHEMA public TO ${role}; GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${role}; GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    );
    const backupUrl = new URL(u);
    backupUrl.username = role;
    backupUrl.password = password;
    const reader = new Client({ connectionString: backupUrl.toString() });
    await reader.connect();
    try {
      validateRole(
        (
          await reader.query(
            `SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,EXISTS(SELECT 1 FROM pg_roles n WHERE n.rolname='neon_superuser' AND pg_has_role(current_user,n.oid,'MEMBER')) managed_admin FROM pg_roles WHERE rolname=current_user`,
          )
        ).rows[0],
      );
      const access = (
        await reader.query(
          `SELECT relname,has_table_privilege(oid,'SELECT') readable,has_table_privilege(oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') writable FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname`,
        )
      ).rows;
      assert.deepEqual(access.map((r) => r.relname).sort(), accountingTables);
      assert(access.every((r) => r.readable && !r.writable));
      assert.equal(
        (await reader.query("SHOW default_transaction_read_only")).rows[0]
          .default_transaction_read_only,
        "on",
      );
      assert.deepEqual(
        (
          await reader.query(
            `SELECT has_database_privilege(current_database(),'CREATE') ddl,has_schema_privilege('public','CREATE') schema_ddl,pg_has_role(current_user,'pusula_finance_executor','MEMBER') executor_member`,
          )
        ).rows[0],
        { ddl: false, schema_ddl: false, executor_member: false },
      );
      await assert.rejects(reader.query('DELETE FROM "FinanceJournal"'));
      assert.equal(
        (
          await reader.query(
            "SELECT has_function_privilege(current_user,'k4_expense(jsonb)','EXECUTE') allowed",
          )
        ).rows[0].allowed,
        false,
      );
    } finally {
      await reader.end();
    }
    await admin.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const before = await snapshot(admin);
    assert.equal(Object.keys(before.tables).length, 56);
    assert.equal(
      (
        await admin.query(
          "SELECT count(*)::int n FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relforcerowsecurity",
        )
      ).rows[0].n,
      42,
    );
    const token = (await admin.query("SELECT pg_export_snapshot() snapshot"))
      .rows[0].snapshot;
    const tool = (name: string) =>
      resolve(
        `.data/tools/postgresql18-client/${name}${process.platform === "win32" ? ".exe" : ""}`,
      );
    const dump = join(backupDir, "source.dump"),
      env = pgEnvironment(backupUrl);
    await runTool(
      tool("pg_dump"),
      ["-Fc", "--no-password", `--snapshot=${token}`, `--file=${dump}`],
      env,
      120000,
    );
    validateToc(
      await runTool(tool("pg_restore"), ["--list", dump], env),
      accountingTables,
    );
    await admin.query("COMMIT");
    const context = newContext({
      sourceEnvironment: "fixture",
      databaseVersion: "18.6",
      schemaVersion: sha(before.catalog),
      coverageSha256: sha(accountingTables),
      keyId: "k5-synthetic-only",
    });
    // This fixture proves coverage/crypto/restore, not acceptance of the remote source policy.
    // Optional v1 field omitted rather than falsely labelling the source strict-v1.
    delete context.securityPolicy;
    const cipher = join(backupDir, "archive.gcm"),
      manifest = await sealFile(dump, cipher, context, key);
    await saveManifest(join(backupDir, "manifest.json"), manifest);
    const copy = join(copyDir, "archive.gcm");
    await copyFile(cipher, copy);
    await saveManifest(join(copyDir, "manifest.json"), manifest);
    const verified = await verifyFile(
      copy,
      JSON.parse(await readFile(join(copyDir, "manifest.json"), "utf8")),
      key,
      context.keyId,
    );
    assert.equal(verified.plaintextSha256, (await digestFile(dump)).sha256);
    const bad = { ...manifest, authTag: "0".repeat(32) };
    await assert.rejects(verifyFile(copy, bad, key, context.keyId));
    decrypted = await decryptToPrivateFile(
      copy,
      manifest,
      key,
      context.keyId,
      backupDir,
    );
    const name = `pusula_k5_restore_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    const targetUrl = new URL(u);
    targetUrl.pathname = `/${name}`;
    const target = new Client({ connectionString: targetUrl.toString() });
    await target.connect();
    try {
      assert.equal(
        (
          await target.query(
            "SELECT count(*)::int n FROM pg_class WHERE relnamespace='public'::regnamespace",
          )
        ).rows[0].n,
        0,
      );
      await runTool(
        tool("pg_restore"),
        [
          "--exit-on-error",
          "--single-transaction",
          "--no-password",
          `--dbname=${name}`,
          decrypted,
        ],
        {
          ...pgEnvironment(targetUrl),
          PGOPTIONS: "-c statement_timeout=120000",
        },
        120000,
      );
      const after = await snapshot(target);
      const checkRoundTrip = await roundTripChecks(
        target,
        before.catalog.constraints as ConstraintRow[],
      );
      before.catalog.constraints = checkRoundTrip.normalized;
      const tableDiff = accountingTables.filter(
        (t) => canonical(before.tables[t]) !== canonical(after.tables[t]),
      );
      const catalogDiff = Object.keys(before.catalog).filter(
        (k) => canonical(before.catalog[k]) !== canonical(after.catalog[k]),
      );
      if (tableDiff.length || catalogDiff.length)
        await writeFile(
          join(dir, "k5-backup-diff.json"),
          JSON.stringify(
            {
              tableDiff,
              catalogDiff,
              catalogs: Object.fromEntries(
                catalogDiff.map((k) => [
                  k,
                  { before: before.catalog[k], after: after.catalog[k] },
                ]),
              ),
            },
            null,
            2,
          ),
        );
      assert.equal(canonical(after), canonical(before));
      // A real weakened target constraint must still be detected; restore it by rollback.
      await target.query("BEGIN");
      try {
        await target.query(
          'ALTER TABLE public."Supplier" DROP CONSTRAINT v42_supplier_values; ALTER TABLE public."Supplier" ADD CONSTRAINT v42_supplier_values CHECK(true)',
        );
        assert.notEqual(
          canonical((await snapshot(target)).catalog.constraints),
          canonical(before.catalog.constraints),
        );
      } finally {
        await target.query("ROLLBACK");
      }
      await writeFile(
        join(copyDir, "synthetic-recovery-key.txt"),
        key.toString("base64"),
        { mode: 0o600 },
      );
      await restrict(copyDir);
      await writeFile(
        join(dir, "k5-backup-verification.json"),
        JSON.stringify(
          {
            status: "PASS",
            tables: 56,
            forcedRls: 42,
            allContentEqual: true,
            catalogEquivalent: true,
            checkRoundTrip: checkRoundTrip.changed,
            weakenedConstraintDetected: true,
            tableDigests: after.tables,
            sourceCatalogSha256: manifest.schemaVersion,
            restoredCatalogSha256: sha(after.catalog),
            normalizedSourceCatalogSha256: sha(before.catalog),
            reconciliation: after.reconciliation,
            backupRole: {
              bypassrls: true,
              superuser: false,
              dml: false,
              readonly: true,
            },
            restoredDatabase: name,
            encryptedCopy: copy,
            offsiteIndependent: false,
            providerEvidence: false,
            syntheticPgRestorePerformed: true,
            remoteRestorePerformed: false,
            ciphertextSha256: manifest.ciphertextSha256,
          },
          null,
          2,
        ),
      );
      console.log(
        "PASS K5 backup: 56-table dump AES-GCM separate local copy decrypt new-empty-database restore all rows/catalog and finance match",
      );
    } finally {
      await target.end();
    }
    await rm(dump);
    await rm(decrypted);
    decrypted = undefined;
  } finally {
    await admin.query("ROLLBACK").catch(() => {});
    if (decrypted) await rm(decrypted, { force: true });
    key.fill(0);
    await admin.end();
  }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/accounting-fixture.ts"))
  void accountingBackupFixture().catch((e) => {
    console.error("K5_BACKUP_FAILED", e?.name, e?.code ?? e?.message);
    console.error(
      typeof e?.stack === "string"
        ? e.stack
            .split("\n")
            .filter((line: string) => line.includes("accounting-fixture.ts"))
            .slice(0, 3)
            .join("\n")
        : "",
    );
    process.exitCode = 1;
  });
