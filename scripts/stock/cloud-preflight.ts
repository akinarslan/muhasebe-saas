// Explicitly authorized development READ ONLY audit. No apply/DDL/DML/role switch,
// provider mutations, credential refresh, business rows, Auth/MFA/session rows.
import { mkdir, readFile, writeFile, realpath, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { loadMigrationEnvironment } from "../db/migration-env";
import { check, hash, migrationTarget } from "../db/migration-safety";
import { restrict } from "../backup/workspace";
import { stockFiles, stockChecksum } from "./migrate";
import {
  loadManagedContract,
  validateContract,
  collectManagedSnapshot,
  auditManagedPre,
  type ManagedSnapshot,
} from "./managed-contract";
import { planManagedTls } from "./managed-preparation";
import { loadProviderCredential } from "./provider-credential";

const codeOf = (error: unknown) => {
  const e = error as { code?: string; message?: string };
  return (
    [e.code, e.message].find(
      (s) => typeof s === "string" && /^[A-Z0-9_]+$/.test(s),
    ) ?? "READONLY_AUDIT_FAILED"
  );
};
export function comparePreflight(
  expected: ManagedSnapshot,
  observed: ManagedSnapshot,
) {
  const compare = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    Object.fromEntries(
      [...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [
        k,
        hash(a[k] ?? null) === hash(b[k] ?? null),
      ]),
    );
  return {
    identity: hash(expected.identity) === hash(observed.identity),
    counts: hash(expected.counts) === hash(observed.counts),
    history: hash(expected.history) === hash(observed.history),
    schema: compare(expected.schema, observed.schema),
    security: compare(expected.security, observed.security),
    cluster: compare(expected.cluster, observed.cluster),
    grantors:
      expected.grantors === null
        ? "NEW_MEASUREMENT_REQUIRES_INDEPENDENT_REVIEW"
        : hash(expected.grantors) === hash(observed.grantors),
  };
}
export async function cloudPreflightMain(args = process.argv.slice(2)) {
  check(
    args.length === 1 && args[0] === "--read-only-development",
    "STOCK_READONLY_APPROVAL_FLAG_REQUIRED",
  );
  check(
    !process.env.PUSULA_LOCAL_FIXTURE && process.env.NODE_ENV !== "production",
    "STOCK_READONLY_ENV_REJECTED",
  );
  const contract = await loadManagedContract();
  validateContract(contract);
  const manifest = await stockFiles();
  check(
    manifest.files[15].checksum === stockChecksum,
    "STOCK_CHECKSUM_REJECTED",
  );
  const dir = resolve(".data/m016-cloud/current");
  await mkdir(dir, { recursive: true });
  check(
    !(await lstat(dir)).isSymbolicLink() && (await realpath(dir)) === dir,
    "STOCK_AUDIT_DIRECTORY_REJECTED",
  );
  await restrict(dir);
  const provider: Record<string, unknown> = {
    observedAt: new Date().toISOString(),
    status: "NOT_CHECKED",
    trace: [],
  };
  const trace = provider.trace as {
    method: string;
    path: string;
    status: number;
  }[];
  try {
    // Explicit environment API key first; otherwise existing OAuth only.
    // No refresh, identity fallback after HTTP failure, or credential logging.
    const credential = await loadProviderCredential(async () =>
      JSON.parse(
        await readFile(
          join(process.env.USERPROFILE ?? "", ".config/neon/credentials.json"),
          "utf8",
        ),
      ),
    );
    provider.credentialSource = credential.type;
    const endpointId = contract.target.host.split(".")[0];
    const get = async (path: string) => {
      const allowed = [
        `/projects/${contract.target.projectId}`,
        `/projects/${contract.target.projectId}/branches/${contract.target.branchId}`,
        `/projects/${contract.target.projectId}/endpoints/${endpointId}`,
      ];
      check(allowed.includes(path), "NEON_ROUTE_REJECTED");
      const r = await fetch(`https://console.neon.tech/api/v2${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${credential.access_token}`,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      trace.push({ method: "GET", path, status: r.status });
      check(r.status === 200, `NEON_HTTP_${r.status}`);
      return r.json();
    };
    const p = (await get(`/projects/${contract.target.projectId}`)).project;
    check(
      p?.id === contract.target.projectId,
      "NEON_PROJECT_IDENTITY_REJECTED",
    );
    const b = (
      await get(
        `/projects/${contract.target.projectId}/branches/${contract.target.branchId}`,
      )
    ).branch;
    check(
      b?.id === contract.target.branchId &&
        b?.project_id === contract.target.projectId &&
        b?.name === "development",
      "NEON_BRANCH_IDENTITY_REJECTED",
    );
    const endpoint = (
      await get(`/projects/${contract.target.projectId}/endpoints/${endpointId}`)
    ).endpoint;
    check(
      endpoint?.id === endpointId &&
        endpoint?.project_id === contract.target.projectId &&
        endpoint?.host === contract.target.host &&
        endpoint?.branch_id === contract.target.branchId &&
        endpoint?.type === "read_write" &&
        endpoint?.disabled === false,
      "NEON_ENDPOINT_IDENTITY_REJECTED",
    );
    provider.status = "CURRENT_IDENTITY_CONFIRMED";
    provider.identity = {
      projectId: p.id,
      branchId: b.id,
      endpointId: endpoint.id,
      host: endpoint.host,
    };
    provider.capacity = {
      pgVersion: p.pg_version,
      retentionSeconds: p.history_retention_seconds,
      branchLogicalSizeLimit: p.branch_logical_size_limit,
      computeMin: endpoint.autoscaling_limit_min_cu,
      computeMax: endpoint.autoscaling_limit_max_cu,
      planQuotaAcceptance: "NOT_ESTABLISHED",
    };
  } catch (error) {
    provider.status = "NEEDS_EVIDENCE";
    provider.reason = codeOf(error);
  }
  await writeFile(
    join(dir, "provider.json"),
    JSON.stringify(provider, null, 2),
  );
  const report: Record<string, unknown> = {
    observedAt: new Date().toISOString(),
    providerStatus: provider.status,
    providerMapping:
      provider.status === "CURRENT_IDENTITY_CONFIRMED"
        ? "current"
        : "historical-approved-host-only",
    status: "NOT_CONNECTED",
    applied: false,
    authMfaSessionRowsRead: false,
    businessRowsRead: false,
    neonMutations: false,
    checksum: stockChecksum,
  };
  let db: Client | undefined;
  let transaction = false;
  try {
    loadMigrationEnvironment(false);
    const u = migrationTarget(process.env.DIRECT_DATABASE_URL, false);
    check(
      u.hostname === contract.target.host &&
        u.pathname === `/${contract.target.database}` &&
        decodeURIComponent(u.username) === contract.target.owner,
      "STOCK_READONLY_TARGET_REJECTED",
    );
    const ca = await readFile(process.env.BACKUP_PG_SSLROOTCERT ?? "", "utf8");
    const tls = planManagedTls(u.toString(), ca);
    db = new Client({
      host: tls.host,
      port: Number(u.port || 5432),
      database: tls.database,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      ssl: tls.ssl,
      connectionTimeoutMillis: 10000,
      statement_timeout: 10000,
      query_timeout: 15000,
      application_name: "pusula_m016_readonly_preflight",
      options:
        "-c default_transaction_read_only=on -c lock_timeout=3000 -c transaction_timeout=60000 -c idle_in_transaction_session_timeout=15000",
    });
    await db.connect();
    const stream = (
      db as unknown as {
        connection: { stream: { encrypted: boolean; authorized: boolean } };
      }
    ).connection.stream;
    check(stream.encrypted && stream.authorized, "STOCK_READONLY_TLS_REJECTED");
    report.tlsVerified = true;
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transaction = true;
    const meta = (
      await db.query(
        "SELECT current_user actor,session_user session_actor,current_database() database,current_setting('server_version') version,current_setting('default_transaction_read_only') default_readonly,current_setting('transaction_read_only') readonly,current_setting('transaction_isolation') isolation,pg_backend_pid() pid,transaction_timestamp() observed_at",
      )
    ).rows[0];
    report.meta = meta;
    check(
      meta.actor === contract.target.owner &&
        meta.session_actor === meta.actor &&
        meta.database === contract.target.database &&
        /^18\.6(?:\s|$)/.test(meta.version) &&
        meta.default_readonly === "on" &&
        meta.readonly === "on" &&
        meta.isolation === "repeatable read",
      "STOCK_READONLY_SESSION_REJECTED",
    );
    const snapshot = await collectManagedSnapshot(db);
    await writeFile(
      join(dir, "development-snapshot.json"),
      JSON.stringify(snapshot, null, 2),
    );
    report.counts = snapshot.counts;
    report.comparison = comparePreflight(contract.pre, snapshot);
    report.snapshotFingerprint = hash(snapshot);
    report.grantors = {
      rows: snapshot.grantors?.length,
      hash: hash(snapshot.grantors),
      enrolled: false,
    };
    report.databaseAccess = (
      await db.query(
        `SELECT datname,has_database_privilege(current_user,oid,'CONNECT') actor_connect,has_database_privilege(current_user,oid,'TEMP') actor_temp,has_database_privilege('pusula_runtime',oid,'CONNECT') runtime_connect,has_database_privilege('pusula_runtime',oid,'TEMP') runtime_temp,has_database_privilege('pusula_auth',oid,'CONNECT') auth_connect,has_database_privilege('pusula_auth',oid,'TEMP') auth_temp FROM pg_database ORDER BY datname`,
      )
    ).rows;
    report.capabilities = (
      await db.query(
        `SELECT current_setting('createrole_self_grant') self_grant,has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION') schema_create_grantable,has_function_privilege(current_user,'public.pusula_can(text,uuid,uuid,uuid,text)','EXECUTE WITH GRANT OPTION') can_execute_grantable,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user`,
      )
    ).rows[0];
    try {
      report.audit = auditManagedPre(contract, snapshot, manifest.files);
      report.status = "READONLY_AUDIT_PASS_WITH_LIMITATIONS";
    } catch (error) {
      report.status = "DRIFT_REVIEW_REQUIRED";
      report.reason = codeOf(error);
    }
  } catch (error) {
    report.status = "READONLY_BLOCKED";
    report.reason = codeOf(error);
  } finally {
    if (db) {
      if (transaction) {
        try {
          await db.query("ROLLBACK");
          report.transactionRolledBack = true;
        } catch {
          report.transactionRolledBack = false;
        }
      }
      await db.end().catch(() => {});
      report.connectionClosed = true;
    }
  }
  await writeFile(
    join(dir, "development-report.json"),
    JSON.stringify(report, null, 2),
  );
  const summary = {
    providerStatus: provider.status,
    providerReason: provider.reason,
    sqlStatus: report.status,
    sqlReason: report.reason,
    applied: false,
    cloudApplyEnabled: false,
  };
  console.log(JSON.stringify(summary));
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  cloudPreflightMain().catch((error) => {
    console.error(
      JSON.stringify({
        status: "BLOCKED",
        code: codeOf(error),
        applied: false,
      }),
    );
    process.exitCode = 1;
  });
