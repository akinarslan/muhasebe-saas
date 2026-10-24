// Local-only rehearsal mechanism. No env loading, provider URL or CLI entry.
import {
  randomBytes,
  randomUUID,
  pbkdf2Sync,
  createHash,
  createHmac,
} from "node:crypto";
import { performance } from "node:perf_hooks";
import { Client } from "pg";
import { assertRiskFixtureTarget } from "./risk-managed";
import { requireCheck } from "./core";

const role = "pusula_fixture_backup";
function scramVerifier(password: string) {
  const salt = randomBytes(16),
    salted = pbkdf2Sync(password, salt, 4096, 32, "sha256");
  const client = createHmac("sha256", salted).update("Client Key").digest();
  const stored = createHash("sha256").update(client).digest();
  const server = createHmac("sha256", salted).update("Server Key").digest();
  try {
    return `SCRAM-SHA-256$4096:${salt.toString("base64")}$${stored.toString("base64")}:${server.toString("base64")}`;
  } finally {
    salt.fill(0);
    salted.fill(0);
    client.fill(0);
    stored.fill(0);
    server.fill(0);
  }
}
export async function fixtureLeaseIdentity(admin: Client, u: URL) {
  assertRiskFixtureTarget(u);
  const x = (
    await admin.query(
      "SELECT current_user actor,current_database() db,current_setting('server_version_num') version,current_setting('data_directory') directory,inet_server_port() port",
    )
  ).rows[0];
  requireCheck(
    x.actor === "fixture_admin" &&
      x.db === "pusula_backup_fixture" &&
      x.version === "180006" &&
      Number(u.port) === x.port &&
      /[\\/]\.data[\\/]fixtures[\\/]e23-[a-f0-9-]{36}[\\/]data$/i.test(
        x.directory,
      ),
    "RISK_LEASE_LOCAL_IDENTITY_REJECTED",
  );
  const params = (
    admin as unknown as { connectionParameters: { host: string; port: number } }
  ).connectionParameters;
  requireCheck(
    params.host === "127.0.0.1" && params.port === Number(u.port),
    "RISK_LEASE_ADMIN_CONNECTION_REJECTED",
  );
}

export type LeaseResult = {
  operation: string;
  outcome: "SUCCEEDED" | "WORKER_FAILED" | "DEADLINE_EXCEEDED";
  lifecycle: "CREDENTIAL_LIFECYCLE_PASS" | "CREDENTIAL_LIFECYCLE_BLOCKED";
  closed: boolean;
  active: number | null;
  oldCredentialRejected: boolean;
  failureCode?: string;
  terminatedPids: number[];
  cleanupDurationMs: number;
};

export async function runFixtureLease(input: {
  admin: Client;
  verifier: Client;
  source: URL;
  durationMs: number;
  work: (url: URL) => Promise<void>;
}): Promise<LeaseResult> {
  const { admin, verifier, source, durationMs } = input;
  await fixtureLeaseIdentity(admin, source);
  await fixtureLeaseIdentity(verifier, source);
  requireCheck(
    Number.isSafeInteger(durationMs) &&
      durationMs >= 100 &&
      durationMs <= 120000,
    "RISK_LEASE_DEADLINE_REJECTED",
  );
  const a = (await admin.query("SELECT pg_backend_pid() pid")).rows[0].pid;
  const b = (await verifier.query("SELECT pg_backend_pid() pid")).rows[0].pid;
  requireCheck(a !== b, "RISK_LEASE_INDEPENDENT_VERIFIER_REQUIRED");
  const before = (
    await verifier.query(
      "SELECT oid,rolcanlogin,rolpassword IS NULL password_null,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_authid WHERE rolname=$1",
      [role],
    )
  ).rows[0];
  requireCheck(
    before &&
      !before.rolcanlogin &&
      before.password_null &&
      !before.rolsuper &&
      !before.rolcreatedb &&
      !before.rolcreaterole &&
      !before.rolreplication &&
      !before.rolinherit &&
      before.rolbypassrls,
    "RISK_LEASE_APPROVED_NOLOGIN_REQUIRED",
  );
  requireCheck(
    (
      await verifier.query(
        "SELECT count(*)::int n FROM pg_stat_activity WHERE usesysid=$1",
        [before.oid],
      )
    ).rows[0].n === 0,
    "RISK_LEASE_EXISTING_SESSIONS_REJECTED",
  );
  requireCheck(
    (
      await verifier.query(
        "SELECT count(*)::int n FROM pg_auth_members WHERE member=$1",
        [before.oid],
      )
    ).rows[0].n === 0,
    "RISK_LEASE_MEMBERSHIP_REJECTED",
  );
  const password = randomBytes(32).toString("hex"),
    url = new URL(source);
  url.password = password;
  const operation = randomUUID(),
    result: LeaseResult = {
      operation,
      outcome: "WORKER_FAILED",
      lifecycle: "CREDENTIAL_LIFECYCLE_BLOCKED",
      closed: false,
      active: null,
      oldCredentialRejected: false,
      terminatedPids: [],
      cleanupDurationMs: 0,
    };
  const deadline = performance.now() + durationMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Send only a generated SCRAM verifier, not the usable password, in SQL.
    // This also avoids usable plaintext in statement/statistics collectors.
    // Generated verifier/ISO contain no quote or operator-supplied SQL.
    await admin.query(
      `ALTER ROLE ${role} LOGIN PASSWORD '${scramVerifier(password)}' VALID UNTIL '${new Date(Date.now() + durationMs).toISOString()}' CONNECTION LIMIT 2`,
    );
    requireCheck(
      (
        await verifier.query(
          "SELECT rolpassword LIKE 'SCRAM-SHA-256$%' scram FROM pg_authid WHERE oid=$1",
          [before.oid],
        )
      ).rows[0].scram,
      "RISK_LEASE_SCRAM_REQUIRED",
    );
    result.outcome = await Promise.race([
      input.work(url).then(
        () => "SUCCEEDED" as const,
        (e: unknown) => {
          const code =
            (e as { code?: string; message?: string }).code ??
            (e as { message?: string }).message;
          result.failureCode =
            code && /^[A-Z0-9_]+$/.test(code)
              ? code
              : "WORKER_ERROR_DETAILS_SUPPRESSED";
          return "WORKER_FAILED" as const;
        },
      ),
      new Promise<LeaseResult["outcome"]>((resolve) => {
        timer = setTimeout(
          () => {
            resolve("DEADLINE_EXCEEDED");
          },
          Math.max(0, deadline - performance.now()),
        );
      }),
    ]);
    if (performance.now() >= deadline) result.outcome = "DEADLINE_EXCEEDED";
  } finally {
    const cleanupStarted = performance.now();
    if (timer) clearTimeout(timer);
    try {
      // Refuse new logins first; kill by role OID across DBs, never application_name.
      await admin.query(
        `ALTER ROLE ${role} NOLOGIN PASSWORD NULL VALID UNTIL '1970-01-01T00:00:00Z' CONNECTION LIMIT 0`,
      );
      result.terminatedPids = (
        await admin.query(
          "SELECT pid,pg_terminate_backend(pid,5000) terminated FROM pg_stat_activity WHERE usesysid=$1 AND pid<>pg_backend_pid()",
          [before.oid],
        )
      ).rows
        .filter((r) => r.terminated)
        .map((r) => r.pid);
      const after = (
        await verifier.query(
          "SELECT rolcanlogin,rolpassword IS NULL password_null FROM pg_authid WHERE oid=$1",
          [before.oid],
        )
      ).rows[0];
      result.active = (
        await verifier.query(
          "SELECT count(*)::int n FROM pg_stat_activity WHERE usesysid=$1",
          [before.oid],
        )
      ).rows[0].n;
      const old = new Client({
        connectionString: url.toString(),
        connectionTimeoutMillis: 2000,
      });
      old.on("error", () => {});
      try {
        await old.connect();
      } catch (e) {
        result.oldCredentialRejected = ["28000", "28P01"].includes(
          (e as { code: string }).code,
        );
      } finally {
        await old.end().catch(() => {});
      }
      result.closed =
        !!after &&
        !after.rolcanlogin &&
        after.password_null &&
        result.active === 0 &&
        result.oldCredentialRejected;
      if (result.closed) result.lifecycle = "CREDENTIAL_LIFECYCLE_PASS";
    } catch {
      result.lifecycle = "CREDENTIAL_LIFECYCLE_BLOCKED";
    }
    url.password = "";
    result.cleanupDurationMs = Math.ceil(performance.now() - cleanupStarted);
  }
  return result;
}
