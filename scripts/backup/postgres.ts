import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import { developmentTarget } from "../../src/server/db/target";
import { BackupError, canonical, requireCheck } from "./core";
import { createHash } from "node:crypto";

export const expectedTables = [
  "Tenant",
  "LegalEntity",
  "Activity",
  "Customer",
  "Material",
  "MaterialVariant",
  "MaterialPriceHistory",
  "AuthUser",
  "AuthSession",
  "AuthAccount",
  "AuthVerification",
  "AuthRateLimit",
  "AuthTwoFactor",
  "AuthBootstrap",
  "AuthSecurityEvent",
  "Membership",
  "Role",
  "Permission",
  "RolePermission",
  "PermissionScope",
  "RoleAssignment",
  "UserPermissionOverride",
  "AuditEvent",
  "AuthInvitation",
  "TenantExchangeRate",
  "AuthMailDelivery",
  "CloudProduct",
  "CloudExpenseType",
  "CloudQuote",
  "CloudSale",
  "CloudSaleLine",
  "CloudPaymentPlan",
  "CloudImportBatch",
  "CloudImportRecord",
  "_prisma_migrations",
].sort();
export const expectedForcedTables = [
  "Tenant",
  "LegalEntity",
  "Activity",
  "Customer",
  "Material",
  "MaterialVariant",
  "MaterialPriceHistory",
  "Membership",
  "PermissionScope",
  "RoleAssignment",
  "UserPermissionOverride",
  "AuditEvent",
  "TenantExchangeRate",
  "CloudProduct",
  "CloudExpenseType",
  "CloudQuote",
  "CloudSale",
  "CloudSaleLine",
  "CloudPaymentPlan",
  "CloudImportBatch",
  "CloudImportRecord",
].sort();
export function sourceTarget(value: string | undefined, fixture = false) {
  let u: URL;
  try {
    u = new URL(value ?? "");
  } catch {
    throw new BackupError("SOURCE_CONFIG_INVALID");
  }
  const allowed = fixture
    ? u.hostname === "127.0.0.1" &&
      u.pathname === "/pusula_backup_fixture" &&
      decodeURIComponent(u.username) === "pusula_fixture_backup" &&
      u.searchParams.get("sslmode") === "disable"
    : u.hostname === developmentTarget.host &&
      u.pathname === `/${developmentTarget.database}` &&
      decodeURIComponent(u.username) === "pusula_backup" &&
      (!u.port || u.port === "5432") &&
      u.searchParams.get("sslmode") === "verify-full";
  requireCheck(
    allowed &&
      ["postgres:", "postgresql:"].includes(u.protocol) &&
      u.password &&
      !u.hash &&
      [...u.searchParams.keys()].every((k) =>
        ["sslmode", "channel_binding"].includes(k),
      ),
    "SOURCE_TARGET_REJECTED",
  );
  return u;
}
// No shell; bounded output; neither stderr nor command arguments escape into logs.
export function runTool(
  bin: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  timeout = 60_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let size = 0,
      settled = false;
    let failure: string | undefined;
    const fail = (code: string) => {
      if (!settled && !failure) {
        failure = code;
        clearTimeout(timer);
        child.kill();
      }
    };
    const timer = setTimeout(() => fail("TOOL_TIMEOUT"), timeout);
    child.on("error", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new BackupError("TOOL_UNAVAILABLE"));
      }
    });
    child.stdout.on("data", (chunk: Buffer) => {
      if (failure) return;
      size += chunk.length;
      if (size > 8 * 1024 ** 2) fail("TOOL_OUTPUT_LIMIT");
      else chunks.push(chunk);
    });
    child.stderr.resume();
    child.on("close", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if (failure) reject(new BackupError(failure));
        else if (code === 0) resolve(Buffer.concat(chunks).toString("utf8"));
        else reject(new BackupError("TOOL_FAILED"));
      }
    });
  });
}
export function toolPath(name: string, env = process.env) {
  if (env.BACKUP_PG_BIN)
    return join(
      env.BACKUP_PG_BIN,
      name + (process.platform === "win32" ? ".exe" : ""),
    );
  const windows = join("C:\\Program Files\\PostgreSQL\\18\\bin", name + ".exe");
  return process.platform === "win32" && existsSync(windows) ? windows : name;
}
export function toolMajor(output: string) {
  const match = output.match(/\(PostgreSQL\) (\d+)\./);
  requireCheck(match && Number(match[1]) === 18, "PG18_TOOLS_REQUIRED");
  return Number(match[1]);
}
export async function checkTools() {
  for (const name of ["pg_dump", "pg_restore", "psql"])
    toolMajor(await runTool(toolPath(name), ["--version"]));
  return 18;
}
export function pgEnvironment(u: URL): NodeJS.ProcessEnv {
  // Do not pass unrelated application/R2/encryption secrets to PostgreSQL processes.
  return {
    NODE_ENV: "development",
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    APPDATA: process.env.APPDATA,
    HOME: process.env.HOME,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGSSLMODE: u.searchParams.get("sslmode")!,
    PGSSLROOTCERT: process.env.BACKUP_PG_SSLROOTCERT || undefined,
    PGCHANNELBINDING: u.searchParams.get("channel_binding") || "prefer",
    PGCONNECT_TIMEOUT: "15",
    PGAPPNAME: "pusula-backup-e2",
    PGOPTIONS:
      "-c default_transaction_read_only=on -c statement_timeout=600000",
  };
}
export async function checkLibpqConnection(u: URL) {
  const output = await runTool(
    toolPath("psql"),
    [
      "--no-password",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "--command=SELECT current_setting('transaction_read_only')",
    ],
    pgEnvironment(u),
  );
  requireCheck(output.trim() === "on", "LIBPQ_READONLY_CONNECTION_FAILED");
}
export async function inspectSource(u: URL) {
  const db = new Client({
    connectionString: u.toString(),
    connectionTimeoutMillis: 15000,
    statement_timeout: 600000,
  });
  try {
    await db.connect();
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await db.query("SET LOCAL row_security = off");
    const role = (
      await db.query(`SELECT r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole, r.rolreplication,
      EXISTS(SELECT 1 FROM pg_roles n WHERE n.rolname='neon_superuser' AND pg_has_role(current_user,n.oid,'MEMBER')) AS managed_admin
      FROM pg_roles r WHERE r.rolname=current_user`)
    ).rows[0];
    validateRole(role);
    const elevated = (
      await db.query(`SELECT
      has_database_privilege(current_database(),'CREATE') AS database_create,
      EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema' AND has_schema_privilege(oid,'CREATE')) AS schema_create,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='S' AND n.nspname='public' AND has_sequence_privilege(c.oid,'UPDATE,USAGE')) AS sequence_write`)
    ).rows[0];
    requireCheck(
      elevated &&
        !elevated.database_create &&
        !elevated.schema_create &&
        !elevated.sequence_write,
      "SOURCE_DDL_OR_SEQUENCE_WRITE_REJECTED",
    );
    const versionNum = Number(
      (await db.query("SHOW server_version_num")).rows[0].server_version_num,
    );
    requireCheck(
      versionNum >= 180000 && versionNum < 190000,
      "SOURCE_VERSION_REJECTED",
    );
    const version = `${Math.floor(versionNum / 10000)}.${versionNum % 10000}`;
    const rows = (
      await db.query(`SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS force,
      has_table_privilege(c.oid,'SELECT') AS readable,
      (has_table_privilege(c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') OR pg_has_role(c.relowner,'USAGE')) AS writable
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' ORDER BY n.nspname,c.relname`)
    ).rows;
    requireCheck(
      rows.every((r) => r.schema === "public" && r.readable && !r.writable),
      "SOURCE_PRIVILEGES_REJECTED",
    );
    requireCheck(
      canonical(rows.map((r) => r.name).sort()) === canonical(expectedTables),
      "SCHEMA_COVERAGE_REJECTED",
    );
    requireCheck(
      canonical(
        rows
          .filter((r) => r.force && r.rls)
          .map((r) => r.name)
          .sort(),
      ) === canonical(expectedForcedTables),
      "RLS_COVERAGE_REJECTED",
    );
    const counts: Record<string, string> = {};
    for (const t of expectedTables)
      counts[t] = (
        await db.query(`SELECT count(*)::text AS n FROM public."${t}"`)
      ).rows[0].n;
    const migrations = (
      await db.query(
        "SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name",
      )
    ).rows;
    requireCheck(
      migrations.length > 0 &&
        migrations.every((m) => m.finished_at && !m.rolled_back_at),
      "MIGRATIONS_INCOMPLETE",
    );
    const localMigrations = await readdir("prisma/migrations", {
      withFileTypes: true,
    });
    const expectedMigrations = await Promise.all(
      localMigrations
        .filter((d) => d.isDirectory())
        .map(async (d) => [
          d.name,
          createHash("sha256")
            .update(
              await readFile(
                join("prisma/migrations", d.name, "migration.sql"),
              ),
            )
            .digest("hex"),
        ]),
    );
    requireCheck(
      canonical(
        migrations.map((m) => [m.migration_name, m.checksum]).sort(),
      ) === canonical(expectedMigrations.sort()),
      "MIGRATION_CHECKSUM_MISMATCH",
    );
    const sha = (value: unknown) =>
      createHash("sha256").update(canonical(value)).digest("hex");
    const schemaVersion = sha(
      migrations.map((m) => [m.migration_name, m.checksum]),
    );
    const coverageSha256 = sha({ tables: rows, counts });
    const snapshot = (await db.query("SELECT pg_export_snapshot() AS snapshot"))
      .rows[0].snapshot as string;
    return {
      db,
      version,
      snapshot,
      schemaVersion,
      coverageSha256,
      tables: rows.length,
    };
  } catch (e) {
    await db.end().catch(() => {});
    throw e;
  }
}
export function validateRole(r: {
  rolbypassrls: boolean;
  rolsuper: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolreplication: boolean;
  managed_admin: boolean;
}) {
  requireCheck(
    r.rolbypassrls &&
      !r.rolsuper &&
      !r.rolcreatedb &&
      !r.rolcreaterole &&
      !r.rolreplication &&
      !r.managed_admin,
    "BACKUP_ROLE_REJECTED",
  );
}
export function validateToc(toc: string) {
  const names = [...toc.matchAll(/^\d+; \d+ \d+ TABLE DATA public (\S+) /gm)]
    .map((m) => m[1].replace(/^"|"$/g, ""))
    .sort();
  requireCheck(
    canonical(names) === canonical(expectedTables),
    "DUMP_TABLE_DATA_INCOMPLETE",
  );
  for (const kind of ["POLICY", "TRIGGER", "FK CONSTRAINT", "INDEX"])
    requireCheck(toc.includes(` ${kind} public `), "DUMP_SCHEMA_INCOMPLETE");
  for (const [table, trigger] of [
    ["CloudSaleLine", "d_seal_sale_line"],
    ["CloudPaymentPlan", "d_seal_payment_plan"],
  ])
    requireCheck(
      toc.includes(` TRIGGER public ${table} ${trigger} `),
      "DUMP_SEALING_TRIGGER_MISSING",
    );
}
