// Local-only V4.2 acceptance runner. No env loading, Neon or R2 client.
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createServer } from "node:net";
import { resolve, join } from "node:path";
import {
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  realpath,
  lstat,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { Client } from "pg";
import { BackupError, requireCheck, digestFile } from "../backup/core";
import { restrict } from "../backup/workspace";
import { runTool } from "../backup/postgres";
import { permissions, roleTemplates } from "../../src/lib/auth/catalog";
const serverBin = resolve(".data/tools/postgresql18-fixture-server/bin");
const suffix = process.platform === "win32" ? ".exe" : "";
const serverTool = (name: string) => join(serverBin, name + suffix);
const safeEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  APPDATA: process.env.APPDATA,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  LANG: "C",
  LC_ALL: "C",
};
const results: { name: string; status: string }[] = [];
const pass = (name: string) => {
  results.push({ name, status: "PASS" });
  console.log(JSON.stringify({ check: name, status: "PASS" }));
};
// A daemon may inherit unused pipe handles on Windows. Server control uses no pipes.
function control(args: string[]): Promise<void> {
  return new Promise((accept, reject) => {
    const child = spawn(serverTool("pg_ctl"), args, {
      env: safeEnv,
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new BackupError("FIXTURE_CONTROL_TIMEOUT"));
    }, 60000);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new BackupError("FIXTURE_CONTROL_UNAVAILABLE"));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) accept();
      else reject(new BackupError("FIXTURE_CONTROL_FAILED"));
    });
  });
}
async function freePort(preferred: number) {
  return new Promise<number>((accept, reject) => {
    const listener = createServer();
    listener.once("error", () =>
      preferred
        ? freePort(0).then(accept, reject)
        : reject(new BackupError("LOCAL_PORT_UNAVAILABLE")),
    );
    listener.listen(preferred, "127.0.0.1", () => {
      const a = listener.address();
      requireCheck(a && typeof a !== "string", "LOCAL_PORT_UNAVAILABLE");
      listener.close((e) => (e ? reject(e) : accept(a.port)));
    });
  });
}
async function identity(data: string) {
  const lines = (await readFile(join(data, "postmaster.pid"), "utf8"))
    .trim()
    .split(/\r?\n/);
  const pid = Number(lines[0]);
  const norm = (p: string) => p.replaceAll("\\", "/").toLowerCase();
  requireCheck(
    Number.isInteger(pid) && pid > 0 && norm(lines[1]) === norm(data),
    "FIXTURE_PID_DIRECTORY_MISMATCH",
  );
  const raw = await runTool(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if(!$p){exit 2}; $p | Select-Object ProcessId,ExecutablePath,CommandLine,CreationDate | ConvertTo-Json -Compress`,
    ],
    safeEnv,
  );
  const processInfo = JSON.parse(raw);
  requireCheck(
    processInfo.ProcessId === pid &&
      norm(processInfo.ExecutablePath) === norm(serverTool("postgres")) &&
      norm(processInfo.CommandLine).includes(norm(data)),
    "FIXTURE_PROCESS_IDENTITY_MISMATCH",
  );
  return { pid, created: processInfo.CreationDate };
}
async function main() {
  requireCheck(
    process.argv.includes("--approve-local-fixture"),
    "LOCAL_FIXTURE_APPROVAL_REQUIRED",
  );
  requireCheck(process.platform === "win32", "WINDOWS_FIXTURE_ONLY");
  const archive = resolve(
    ".data/tools/downloads/postgresql-18.6-5-windows-x64-binaries.zip",
  );
  requireCheck(
    (await digestFile(archive)).sha256 ===
      "e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2",
    "SERVER_ARCHIVE_PIN_MISMATCH",
  );
  const root = resolve(".data/fixtures");
  await mkdir(root, { recursive: true });
  requireCheck(
    !(await lstat(root)).isSymbolicLink() && (await realpath(root)) === root,
    "FIXTURE_ROOT_REJECTED",
  );
  const id = randomUUID(),
    dir = join(root, `v42-${id}`),
    data = join(dir, "data"),
    pwfile = join(dir, "init-password.tmp"),
    port = await freePort(55432);
  await mkdir(dir);
  await restrict(dir);
  const adminPassword = randomBytes(32).toString("hex"),
    runtimePassword = randomBytes(32).toString("hex"),
    authPassword = randomBytes(32).toString("hex"),
    secret = randomBytes(48).toString("base64url");
  const report: Record<string, unknown> = {
    fixtureId: `v42-${id}`,
    host: "127.0.0.1",
    port,
    dataDirectory: data,
    neonOperations: false,
    r2Operations: false,
    results,
  };
  let started = false,
    stopped = false,
    observed: Awaited<ReturnType<typeof identity>> | undefined,
    admin: Client | undefined;
  let failure: string | undefined;
  const connect = (database: string) =>
    new Client({
      host: "127.0.0.1",
      port,
      database,
      user: "fixture_admin",
      password: adminPassword,
      connectionTimeoutMillis: 5000,
    });
  try {
    const versions: Record<string, string> = {};
    for (const name of ["postgres", "initdb", "pg_ctl"]) {
      versions[name] = (
        await runTool(serverTool(name), ["--version"], safeEnv)
      ).trim();
      requireCheck(versions[name].endsWith("18.6"), "PG186_REQUIRED");
    }
    report.versions = versions;
    await writeFile(pwfile, adminPassword + "\n", { flag: "wx", mode: 0o600 });
    await runTool(
      serverTool("initdb"),
      [
        "-D",
        data,
        "-U",
        "fixture_admin",
        "--auth-host=scram-sha-256",
        "--auth-local=scram-sha-256",
        "--pwfile=" + pwfile,
        "--encoding=UTF8",
        "--locale=C",
      ],
      safeEnv,
      120000,
    );
    await rm(pwfile);
    await writeFile(
      join(data, "pg_hba.conf"),
      "host all all 127.0.0.1/32 scram-sha-256\n",
    );
    await writeFile(
      join(data, "postgresql.auto.conf"),
      `listen_addresses='127.0.0.1'\nport=${port}\npassword_encryption='scram-sha-256'\nssl=off\nlog_statement='none'\nlog_min_error_statement='panic'\n`,
    );
    started = true;
    await control([
      "start",
      "-D",
      data,
      "-l",
      join(dir, "postgres.log"),
      "-w",
      "-t",
      "45",
    ]);
    observed = await identity(data);
    report.serverPid = observed.pid;
    admin = connect("postgres");
    await admin.connect();
    const actualData = (await admin.query("SHOW data_directory")).rows[0]
      .data_directory;
    requireCheck(
      actualData.replaceAll("\\", "/").toLowerCase() ===
        data.replaceAll("\\", "/").toLowerCase(),
      "WRONG_CLUSTER",
    );
    requireCheck(
      (await admin.query("SHOW listen_addresses")).rows[0].listen_addresses ===
        "127.0.0.1",
      "NOT_LOOPBACK_ONLY",
    );
    await admin.query("CREATE DATABASE pusula_sprint_b_test");
    for (const role of ["pusula_runtime", "pusula_auth"])
      await admin.query(
        `CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
      );
    await admin.query(
      `CREATE ROLE pusula_test_runtime LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; CREATE ROLE pusula_test_auth LOGIN PASSWORD '${authPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; CREATE ROLE neon_superuser NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    await admin.end();
    admin = connect("pusula_sprint_b_test");
    await admin.connect();
    await admin.query(
      "CREATE TABLE _prisma_migrations(id varchar(36) PRIMARY KEY,checksum varchar(64) NOT NULL,finished_at timestamptz,migration_name varchar(255) NOT NULL,logs text,rolled_back_at timestamptz,started_at timestamptz NOT NULL DEFAULT now(),applied_steps_count integer NOT NULL DEFAULT 0)",
    );
    const migrations = (
      await readdir("prisma/migrations", { withFileTypes: true })
    )
      .filter((d) => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const m of migrations) {
      const sql = await readFile(
        join("prisma/migrations", m.name, "migration.sql"),
      );
      await admin.query("BEGIN");
      try {
        // Migration014 is explicitly transactional for Prisma deploy as well.
        // Use its body inside this runner's transaction so metadata shares the commit.
        const text = sql.toString("utf8");
        const body =
          /^\s*BEGIN;/i.test(text) && /COMMIT;\s*$/i.test(text)
            ? text.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "")
            : text;
        await admin.query(body);
        await admin.query(
          "INSERT INTO _prisma_migrations(id,checksum,finished_at,migration_name,applied_steps_count) VALUES($1,$2,now(),$3,1)",
          [
            randomUUID(),
            createHash("sha256").update(sql).digest("hex"),
            m.name,
          ],
        );
        await admin.query("COMMIT");
      } catch (e) {
        await admin.query("ROLLBACK");
        throw e;
      }
    }
    for (const p of permissions)
      await admin.query(
        'INSERT INTO "Permission"(id,label,module) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
        [p.id, p.label, p.module],
      );
    for (const r of roleTemplates) {
      await admin.query(
        'INSERT INTO "Role"(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',
        [r.id, r.name],
      );
      for (const p of r.permissions)
        await admin.query(
          'INSERT INTO "RolePermission"("roleId","permissionId") VALUES($1,$2) ON CONFLICT DO NOTHING',
          [r.id, p],
        );
    }
    await admin.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      GRANT USAGE ON SCHEMA public TO pusula_test_runtime,pusula_test_auth;
      GRANT SELECT ON "Tenant","LegalEntity","Activity","Role","Permission","RolePermission" TO pusula_test_runtime;
      GRANT SELECT,INSERT,UPDATE,DELETE ON "Customer","Material","MaterialVariant","Membership","RoleAssignment","UserPermissionOverride","PermissionScope" TO pusula_test_runtime;
      GRANT SELECT,INSERT ON "MaterialPriceHistory","AuditEvent" TO pusula_test_runtime;
      GRANT SELECT,INSERT,UPDATE,DELETE ON "AuthUser","AuthSession","AuthAccount","AuthVerification","AuthRateLimit","AuthTwoFactor","AuthInvitation" TO pusula_test_auth;
      GRANT SELECT ON "AuthBootstrap" TO pusula_test_auth;
      GRANT SELECT,INSERT ON "AuthSecurityEvent" TO pusula_test_auth;
      GRANT SELECT,INSERT,UPDATE ON "AuthMailDelivery" TO pusula_test_auth;`);
    report.migrationCount = migrations.length;
    const counts = (
      await admin.query(
        `SELECT count(*)::int AS tables,count(*) FILTER(WHERE c.relforcerowsecurity)::int AS forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'`,
      )
    ).rows[0];
    requireCheck(
      counts.tables === 38 && counts.forced === 24,
      "V42_SCOPE_REJECTED",
    );
    report.schema = counts;
    pass("fourteen-local-migrations-38-tables-24-force-rls");
    await writeFile(
      join(dir, "target.json"),
      JSON.stringify({
        id,
        host: "127.0.0.1",
        port,
        database: "pusula_sprint_b_test",
        dataDirectory: data,
      }),
      { mode: 0o600, flag: "wx" },
    );
    const url = (user: string, password: string) =>
      `postgresql://${user}:${password}@127.0.0.1:${port}/pusula_sprint_b_test?sslmode=disable`;
    const env: NodeJS.ProcessEnv = {
      ...safeEnv,
      PUSULA_LOCAL_FIXTURE: id,
      PUSULA_DB_TARGET: "test",
      TEST_DIRECT_DATABASE_URL: url("fixture_admin", adminPassword),
      TEST_DATABASE_URL: url("pusula_test_runtime", runtimePassword),
      TEST_AUTH_DATABASE_URL: url("pusula_test_auth", authPassword),
      AUTH_TEST_SECRET: secret,
      DATABASE_URL: url("pusula_test_runtime", runtimePassword),
      AUTH_DATABASE_URL: url("pusula_test_auth", authPassword),
      DIRECT_DATABASE_URL: url("fixture_admin", adminPassword),
      AUTH_SECRET: secret,
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      RESEND_API_KEY: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
    };
    const scripts = process.argv.includes("--supplier-only")
      ? ["scripts/auth/verify-c2.ts", "scripts/suppliers/verify.ts"]
      : [
          "scripts/db/verify.ts",
          ...["c1", "c2", "c3", "c4", "c5", "c6", "c61"].map(
            (s) => `scripts/auth/verify-${s}.ts`,
          ),
          "scripts/auth/verify-d.ts",
          "scripts/suppliers/verify.ts",
        ];
    report.testMode = process.argv.includes("--supplier-only")
      ? "supplier-only"
      : "full";
    const runJob = (
      args: string[],
      name: string,
      jobEnv: NodeJS.ProcessEnv,
      timeout: number,
    ) =>
      new Promise<string>((accept, reject) => {
        report.runningJob = name;
        const child = spawn(process.execPath, args, {
          env: jobEnv,
          windowsHide: true,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let out = "",
          err = "";
        const timer = setTimeout(() => child.kill(), timeout);
        child.stdout.on("data", (b) => {
          out = (out + b.toString()).slice(-4 * 1024 * 1024);
          if (name === "playwright") {
            for (const match of b
              .toString()
              .matchAll(/Browser phase: ([A-Za-z -]+)/g))
              console.log(JSON.stringify({ browserPhase: match[1].trim() }));
          }
        });
        child.stderr.on("data", (b) => {
          err = (err + b.toString()).slice(-4 * 1024 * 1024);
        });
        child.once("error", () => {
          clearTimeout(timer);
          reject(new BackupError("FIXTURE_CHILD_UNAVAILABLE"));
        });
        child.once("close", async (code) => {
          clearTimeout(timer);
          let output = out + "\n" + err;
          for (const value of [
            adminPassword,
            runtimePassword,
            authPassword,
            secret,
          ])
            output = output.replaceAll(value, "[redacted]");
          output = output.replace(
            /postgres(?:ql)?:\/\/[^\s'"<>]+/gi,
            "[connection]",
          );
          await writeFile(join(dir, name + ".log"), output, { mode: 0o600 });
          if (code === 0) accept(out);
          else reject(new BackupError("FIXTURE_CHILD_FAILED"));
        });
      });
    for (const script of scripts) {
      const output = await runJob(
        ["--conditions=react-server", "--import", "tsx", script],
        script.split("/").at(-1)!,
        env,
        300000,
      );
      await writeFile(join(dir, script.split("/").at(-1)! + ".log"), output, {
        mode: 0o600,
      });
      const passed = output
        .split(/\r?\n/)
        .filter((l) => /^PASS\b/.test(l)).length;
      results.push({ name: script + ` (${passed} checks)`, status: "PASS" });
      console.log(JSON.stringify({ script, checks: passed, status: "PASS" }));
    }
    if (process.argv.includes("--with-browser")) {
      const output = await runJob(
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/auth/prepare-browser.ts",
        ],
        "prepare-browser",
        env,
        180000,
      );
      await writeFile(join(dir, "prepare-browser.log"), output);
      const browser = await runJob(
        [
          "node_modules/@playwright/test/cli.js",
          "test",
          "--config",
          "playwright.auth.config.ts",
        ],
        "playwright",
        { ...env, NODE_ENV: "development" },
        900000,
      );
      await writeFile(join(dir, "playwright.log"), browser, { mode: 0o600 });
      pass("desktop-mobile-auth-cloud-d7-suppliers-browser");
      await runJob(
        [
          "node_modules/@playwright/test/cli.js",
          "test",
          "--config",
          "playwright.config.ts",
          "--trace",
          "off",
        ],
        "demo-playwright",
        { ...env, NODE_ENV: "development" },
        600000,
      );
      pass("desktop-mobile-demo-regression-browser");
    }
  } catch (e) {
    failure = e instanceof BackupError ? e.code : "LOCAL_FIXTURE_FAILED";
    report.databaseErrorCode = /^[A-Z0-9]{5}$/.test(
      (e as { code?: string }).code ?? "",
    )
      ? (e as { code: string }).code
      : undefined;
  } finally {
    await admin?.end().catch(() => {});
    await rm(pwfile, { force: true });
    if (started) {
      try {
        const current = await identity(data);
        requireCheck(
          !observed ||
            (current.pid === observed.pid &&
              current.created === observed.created),
          "FIXTURE_PID_CHANGED",
        );
        await control(["stop", "-D", data, "-m", "fast", "-w", "-t", "45"]);
        requireCheck(
          !(await readFile(join(data, "postmaster.pid")).then(
            () => true,
            () => false,
          )),
          "FIXTURE_PID_REMAINS",
        );
        const absent = await runTool(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `if(Get-CimInstance Win32_Process -Filter 'ProcessId = ${current.pid}'){'PRESENT'}else{'ABSENT'}`,
          ],
          safeEnv,
        );
        requireCheck(absent.trim() === "ABSENT", "FIXTURE_PROCESS_REMAINS");
        stopped = true;
      } catch {
        failure = "FIXTURE_STOP_FAILED";
      }
    }
    report.serverStopped = stopped;
    report.status = failure ? "FAIL" : "PASS";
    report.failureCode = failure ?? null;
    await writeFile(
      join(dir, "verification.json"),
      JSON.stringify(report, null, 2),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        fixtureId: report.fixtureId,
        status: report.status,
        serverStopped: stopped,
        failureCode: failure ?? null,
      }),
    );
  }
  if (failure) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "V42 local fixture preparation failed; sensitive details suppressed.",
  );
  process.exitCode = 1;
});
