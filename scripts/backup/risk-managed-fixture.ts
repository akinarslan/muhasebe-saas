// Opt-in extension of the existing isolated PG18.6 backup harness.
import { Client } from "pg";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { writeFile, copyFile, mkdir } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import {
  runFixtureLease,
  fixtureLeaseIdentity,
  type LeaseResult,
} from "./risk-managed-lease";
import {
  openRiskManagedFixture,
  riskManagedReadiness,
  riskManagedProfile,
} from "./risk-managed";
import {
  requireCheck,
  canonical,
  newContext,
  sealFile,
  verifyFile,
} from "./core";
import { pgEnvironment, runTool, validateToc } from "./postgres";
import { decryptToPrivateFile } from "./decrypt";
import { restoreFixture, catalogSqls } from "./restore-fixture";
import { sourceProfile, type SourceRelease } from "./source-profile";

async function worker(url: URL, mode: string) {
  await new Promise<void>((ok, bad) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", resolve("scripts/backup/risk-managed-worker.ts")],
      {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        windowsHide: true,
        env: {
          NODE_ENV: "test",
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
        },
      },
    );
    child.once("error", () => bad(Error("WORKER_START_FAILED")));
    child.once("exit", (code) =>
      code === 0 ? ok() : bad(Error("WORKER_EXIT")),
    );
    child.send({ url: url.toString(), mode });
  });
}

export async function verifyRiskManagedFixture(input: {
  admin: Client;
  source: URL;
  release: SourceRelease;
  directory: string;
  dataDirectory: string;
  connect: (db: string, user?: string, password?: string) => Client;
  originalPassword: string;
  readerPassword: string;
  adminPassword: string;
  pgDump: string;
  pgRestore: string;
  pass: (s: string) => void;
}) {
  const { admin, source, connect, pass, release } = input;
  await fixtureLeaseIdentity(admin, source);
  const verifier = connect("pusula_backup_fixture");
  await verifier.connect();
  const results: LeaseResult[] = [];
  const catalog = async () => {
    const out: Record<string, unknown> = {};
    for (const [k, sql] of Object.entries(catalogSqls))
      out[k] = (await admin.query(sql)).rows;
    return out;
  };
  const before = canonical(await catalog());
  const adminPid = (await verifier.query("SELECT pg_backend_pid() pid")).rows[0]
    .pid;
  await admin.query(
    "ALTER ROLE pusula_fixture_backup NOLOGIN PASSWORD NULL NOINHERIT CONNECTION LIMIT 0",
  );
  try {
    for (const mode of ["success", "error", "timeout", "crash"]) {
      const result = await runFixtureLease({
        admin,
        verifier,
        source,
        durationMs: mode === "timeout" ? 3000 : 10000,
        work: (u) => worker(u, mode),
      });
      requireCheck(
        result.lifecycle === "CREDENTIAL_LIFECYCLE_PASS" &&
          result.closed &&
          result.active === 0 &&
          result.oldCredentialRejected,
        "RISK_LEASE_CLEANUP_FAILED",
      );
      requireCheck(
        result.outcome ===
          (mode === "success"
            ? "SUCCEEDED"
            : mode === "timeout"
              ? "DEADLINE_EXCEEDED"
              : "WORKER_FAILED"),
        "RISK_LEASE_WRONG_OUTCOME",
      );
      if (mode === "timeout")
        requireCheck(
          result.terminatedPids.length > 0,
          "RISK_DEADLINE_DID_NOT_TERMINATE_LIVE_SESSION",
        );
      requireCheck(
        (await verifier.query("SELECT pg_backend_pid() pid")).rows[0].pid ===
          adminPid,
        "RISK_LEASE_KILLED_UNRELATED_SESSION",
      );
      results.push(result);
      pass(
        `risk-lease-${mode}-nologin-null-password-no-active-old-credential-rejected`,
      );
    }
    const lostVerifier = connect("pusula_backup_fixture");
    await lostVerifier.connect();
    const unverified = await runFixtureLease({
      admin,
      verifier: lostVerifier,
      source,
      durationMs: 10000,
      work: async () => {
        await lostVerifier.end();
      },
    });
    requireCheck(
      unverified.lifecycle === "CREDENTIAL_LIFECYCLE_BLOCKED" &&
        !unverified.closed,
      "RISK_MISSING_CLOSE_PROOF_ACCEPTED",
    );
    requireCheck(
      (
        await verifier.query(
          "SELECT count(*)::int n FROM pg_stat_activity WHERE usesysid='pusula_fixture_backup'::regrole",
        )
      ).rows[0].n === 0,
      "RISK_LOST_VERIFIER_LEFT_SESSIONS",
    );
    results.push(unverified);
    pass("risk-close-proof-loss-is-blocked-never-pass");
    // Reproduce PUBLIC risks in a separate NEW local DB, not a provider DB.
    await admin.query(
      "CREATE DATABASE pusula_backup_fixture_risk TEMPLATE template0",
    );
    const meta = connect("pusula_backup_fixture_risk");
    await meta.connect();
    try {
      await meta.query("CREATE EXTENSION pg_stat_statements VERSION '1.12'");
      await meta.query(
        "SELECT 987654321::bigint AS risk_other_role_secret_marker",
      );
      await meta.query(
        "CREATE TABLE public.health_check(id int PRIMARY KEY,updated_at timestamptz); CREATE VIEW public.risk_metadata AS SELECT 1::int AS marker",
      );
      await meta.query("GRANT SELECT ON public.risk_metadata TO PUBLIC");
      await meta.query(
        `CREATE FUNCTION public.health_check_write_succeeds() RETURNS integer LANGUAGE plpgsql AS $body$ BEGIN INSERT INTO public.health_check VALUES (1,now()) ON CONFLICT(id) DO UPDATE SET updated_at=now(); RETURN 1; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'local health denied: %',SQLSTATE; END $body$`,
      );
      const result = await runFixtureLease({
        admin,
        verifier,
        source,
        durationMs: 15000,
        work: async (u) => {
          const db = new Client({
            connectionString: u.toString(),
            connectionTimeoutMillis: 3000,
          });
          await db.connect();
          db.on("error", () => {});
          try {
            for (const table of [
              "Tenant",
              "AuthUser",
              ...(release === "post017" ? ["FinanceJournal"] : []),
            ]) {
              for (const sql of [
                `INSERT INTO "${table}" DEFAULT VALUES`,
                `UPDATE "${table}" SET id=id`,
                `DELETE FROM "${table}"`,
                `TRUNCATE "${table}"`,
              ]) {
                await db.query("BEGIN READ WRITE");
                let code: string | undefined;
                try {
                  await db.query(sql);
                } catch (e) {
                  code = (e as { code: string }).code;
                } finally {
                  await db.query("ROLLBACK");
                }
                requireCheck(
                  code === "42501",
                  "RISK_BUSINESS_AUTH_FINANCE_DML_NOT_DENIED",
                );
              }
            }
            for (const sql of [
              "CREATE ROLE risk_denied_role",
              "ALTER ROLE pusula_fixture_backup CREATEROLE",
              "GRANT pusula_runtime TO pusula_fixture_backup",
              "SET ROLE pusula_runtime",
              "CREATE SCHEMA risk_denied",
              "CREATE TABLE public.risk_denied(id int)",
              "SELECT public.pusula_can('finance.read',NULL::uuid,NULL::uuid,NULL::uuid,NULL::text)",
              ...(release !== "pre016"
                ? ["SET ROLE pusula_stock_executor"]
                : []),
              ...(release === "post017"
                ? ["SET ROLE pusula_finance_executor"]
                : []),
            ]) {
              await db.query("BEGIN READ WRITE");
              let code: string | undefined;
              try {
                await db.query(sql);
              } catch (e) {
                code = (e as { code: string }).code;
              } finally {
                await db.query("ROLLBACK");
              }
              requireCheck(
                code === "42501",
                "RISK_ROLE_DDL_EXECUTE_NOT_DENIED",
              );
            }
            requireCheck(
              (
                await db.query(
                  'SELECT count(DISTINCT "tenantId")::int n FROM "Customer"',
                )
              ).rows[0].n === 2,
              "RISK_FULL_TENANT_SELECT_FAILED",
            );
            const inventory = (
              await db.query(
                "SELECT datname,datallowconn,has_database_privilege(current_user,oid,'CONNECT') can_connect,has_database_privilege(current_user,oid,'TEMP') can_temp,has_database_privilege(current_user,oid,'CREATE') can_create FROM pg_database ORDER BY datname",
              )
            ).rows;
            await writeFile(
              join(input.directory, "risk-managed-database-inventory.json"),
              JSON.stringify(inventory, null, 2),
            );
            requireCheck(
              inventory.some(
                (r) =>
                  r.datname === "pusula_backup_fixture_risk" &&
                  r.can_connect &&
                  r.can_temp &&
                  !r.can_create,
              ),
              "RISK_OTHER_DATABASE_INVENTORY_FAILED",
            );
            const otherUrl = new URL(u);
            otherUrl.pathname = "/pusula_backup_fixture_risk";
            const other = new Client({
              connectionString: otherUrl.toString(),
              connectionTimeoutMillis: 3000,
            });
            await other.connect();
            try {
              const hidden = (
                await other.query(
                  "SELECT query,queryid FROM public.pg_stat_statements WHERE userid='fixture_admin'::regrole AND dbid=(SELECT oid FROM pg_database WHERE datname=current_database())",
                )
              ).rows;
              requireCheck(
                hidden.length > 0 &&
                  hidden.every(
                    (r) =>
                      (r.query === null ||
                        r.query === "<insufficient privilege>") &&
                      (r.queryid === null || String(r.queryid) === "0"),
                  ),
                "RISK_OTHER_ROLE_QUERY_TEXT_VISIBLE",
              );
              await other.query("SELECT 123::int AS risk_own_query_marker");
              requireCheck(
                (
                  await other.query(
                    "SELECT count(*)::int n FROM public.pg_stat_statements WHERE userid=current_user::regrole AND query LIKE '%risk_own_query_marker%'",
                  )
                ).rows[0].n > 0,
                "RISK_OWN_QUERY_VISIBILITY_NOT_OBSERVED",
              );
              requireCheck(
                (
                  await other.query(
                    "SELECT dealloc,stats_reset FROM public.pg_stat_statements_info",
                  )
                ).rowCount === 1,
                "RISK_STATS_INFO_METADATA_FAILED",
              );
              requireCheck(
                (await other.query("SELECT marker FROM public.risk_metadata"))
                  .rows[0].marker === 1,
                "RISK_PUBLIC_METADATA_UNREADABLE",
              );
              let denied = false;
              try {
                await other.query(
                  "SELECT public.health_check_write_succeeds()",
                );
              } catch (e) {
                denied =
                  (e as { code: string; message: string }).code === "P0001" &&
                  (e as Error).message.includes("42501");
              }
              requireCheck(denied, "RISK_INVOKER_HEALTH_WRITE_NOT_DENIED");
              await other.query(
                "CREATE TEMP TABLE risk_temp(id int); INSERT INTO risk_temp VALUES(1)",
              );
              const oid = (await other.query("SELECT lo_create(0) oid")).rows[0]
                .oid;
              requireCheck(
                (
                  await other.query(
                    "SELECT lomowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) owned FROM pg_largeobject_metadata WHERE oid=$1",
                    [oid],
                  )
                ).rows[0].owned,
                "RISK_LO_OWNERSHIP_NOT_OBSERVED",
              );
              requireCheck(
                (await other.query("SELECT lo_unlink($1) removed", [oid]))
                  .rows[0].removed === 1,
                "RISK_LO_CLEANUP_FAILED",
              );
            } finally {
              await other.end();
            }
            for (const entry of inventory.filter(
              (r) => r.datallowconn && !r.can_connect,
            )) {
              const deniedUrl = new URL(u);
              deniedUrl.pathname = "/" + entry.datname;
              const deniedDb = new Client({
                connectionString: deniedUrl.toString(),
                connectionTimeoutMillis: 2000,
              });
              let code: string | undefined;
              try {
                await deniedDb.connect();
              } catch (e) {
                code = (e as { code: string }).code;
              } finally {
                await deniedDb.end().catch(() => {});
              }
              requireCheck(
                code === "42501",
                "RISK_CROSS_DB_CONNECT_INVENTORY_MISMATCH",
              );
            }
          } finally {
            await db.end();
          }
        },
      });
      requireCheck(
        result.outcome === "SUCCEEDED" && result.closed,
        result.failureCode ?? "RISK_SECURITY_LEASE_FAILED",
      );
      results.push(result);
      requireCheck(
        (await meta.query("SELECT count(*)::int n FROM public.health_check"))
          .rows[0].n === 0,
        "RISK_HEALTH_DATA_MUTATED",
      );
      pass(
        "risk-negative-dml-auth-finance-role-grant-ddl-execute-and-full-tenant-select",
      );
      pass(
        "risk-public-metadata-cross-db-temp-owned-large-object-classified-and-cleaned",
      );
      pass(
        "risk-pg-stat-1.12-real-c-other-role-text-hidden-own-text-visible-info-readable",
      );
    } finally {
      await meta.end();
      await admin.query("DROP DATABASE pusula_backup_fixture_risk");
    }

    // Actual lease-based adapter -> existing dump/crypto/decrypt/restore engine.
    const archiveResult = await runFixtureLease({
      admin,
      verifier,
      source,
      durationMs: 120000,
      work: async (u) => {
        const opened = await openRiskManagedFixture(u, release, true);
        let snapshotClosed = false;
        const dir = join(input.directory, "risk-managed-archive");
        await mkdir(dir);
        const dump = join(dir, "archive.dump"),
          cipher = join(dir, "archive.gcm"),
          key = randomBytes(32),
          keyId = "risk-fixture-key";
        try {
          const env: NodeJS.ProcessEnv = {
            ...pgEnvironment(u),
            NODE_ENV: "test",
          };
          await runTool(
            input.pgDump,
            [
              "-Fc",
              "--no-password",
              "--snapshot=" + opened.snapshot,
              "--file=" + dump,
            ],
            env,
            60000,
          );
          validateToc(
            await runTool(input.pgRestore, ["--list", dump]),
            sourceProfile(release).tables,
          );
          const manifest = await sealFile(
            dump,
            cipher,
            newContext({
              sourceEnvironment: "fixture",
              databaseVersion: opened.version,
              schemaVersion: opened.schemaVersion,
              coverageSha256: opened.coverageSha256,
              keyId,
              securityPolicy: "strict-v1",
            }),
            key,
          );
          // Inner manifest retains the existing STRICT fixture format. The sidecar
          // records this distinct local rehearsal; it cannot authorize upload.
          const independent = join(
            input.directory,
            "risk-managed-independent-copy",
          );
          await mkdir(independent);
          const copy = join(independent, "archive.gcm");
          await copyFile(cipher, copy);
          await verifyFile(copy, manifest, key, keyId);
          const decrypted = await decryptToPrivateFile(
            copy,
            manifest,
            key,
            keyId,
            independent,
          );
          await opened.db.query("ROLLBACK");
          await opened.db.end();
          snapshotClosed = true;
          const restored = await restoreFixture({
            source: admin,
            connect,
            dataDirectory: input.dataDirectory,
            directory: input.directory,
            decrypted,
            pgRestore: input.pgRestore,
            environment: { ...env, PGPASSWORD: input.adminPassword },
            readerPassword: input.readerPassword,
            backupPassword: decodeURIComponent(u.password),
            pass,
            tables: sourceProfile(release).tables,
          });
          requireCheck(
            /^pusula_restore_fixture_[a-f0-9]{32}$/.test(
              restored.targetDatabase,
            ),
            "RISK_RESTORE_CLEANUP_TARGET_REJECTED",
          );
          // This fixture-owned target was created by the call immediately above.
          await admin.query(`DROP DATABASE "${restored.targetDatabase}"`);
          await writeFile(
            join(dir, "risk-managed-envelope.json"),
            JSON.stringify(
              {
                profile: riskManagedProfile.name,
                localOnly: true,
                release,
                manifest,
                innerPolicy: "strict-v1",
                remoteApproved: false,
              },
              null,
              2,
            ),
          );
        } finally {
          key.fill(0);
          if (!snapshotClosed) {
            await opened.db.query("ROLLBACK").catch(() => {});
            await opened.db.end().catch(() => {});
          }
        }
      },
    });
    results.push(archiveResult);
    requireCheck(
      archiveResult.outcome === "SUCCEEDED" && archiveResult.closed,
      "RISK_ADAPTER_LEASE_FAILED",
    );
    pass("risk-lease-dump-gcm-hmac-independent-copy-decrypt-restore-adapter");
    requireCheck(
      canonical(await catalog()) === before,
      "RISK_POSTFLIGHT_CATALOG_ACL_DRIFT",
    );
    const flags = (
      await verifier.query(
        "SELECT rolcanlogin,rolpassword IS NULL password_null,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_authid WHERE rolname='pusula_fixture_backup'",
      )
    ).rows[0];
    requireCheck(
      flags &&
        Object.entries(flags).every(
          ([k, v]) => v === ["password_null", "rolbypassrls"].includes(k),
        ),
      "RISK_POSTFLIGHT_ROLE_FLAGS_DRIFT",
    );
    requireCheck(
      (
        await verifier.query(
          "SELECT count(*)::int n FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid='pusula_fixture_backup'::regrole AND deptype='o'",
        )
      ).rows[0].n === 0,
      "RISK_POSTFLIGHT_BACKUP_OWNERSHIP",
    );
    requireCheck(
      (
        await verifier.query(
          "SELECT count(*)::int n FROM pg_auth_members WHERE member='pusula_fixture_backup'::regrole",
        )
      ).rows[0].n === 0,
      "RISK_POSTFLIGHT_MEMBERSHIP",
    );
    await writeFile(
      join(input.directory, "risk-managed-verification.json"),
      JSON.stringify(
        {
          policy: "RISK_MANAGED_POLICY_PASS",
          scope: "local-fixture-contract-only",
          credential: "CREDENTIAL_LIFECYCLE_PASS",
          remote: riskManagedReadiness({
            target: riskManagedProfile.target,
            routineHashes: {},
          }),
          results,
          catalogSha256: createHash("sha256").update(before).digest("hex"),
          postflightAclOwnershipConnections: true,
        },
        null,
        2,
      ),
    );
    pass("risk-independent-postflight-role-acl-ownership-connections");
  } finally {
    // Restore ONLY this harness's pre-existing synthetic login for its legacy
    // regression matrix. Real lifecycle has no such activation fallback.
    await admin.query(
      `ALTER ROLE pusula_fixture_backup LOGIN INHERIT PASSWORD '${input.originalPassword}' VALID UNTIL 'infinity' CONNECTION LIMIT -1`,
    );
    await verifier.end();
  }
}
