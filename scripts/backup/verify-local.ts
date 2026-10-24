// Explicitly local integration test. Never loads .env or imports an application/R2 client.
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createServer } from "node:net";
import { resolve, join, relative, isAbsolute } from "node:path";
import {
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  realpath,
  lstat,
} from "node:fs/promises";
import { Client } from "pg";
import { spawn } from "node:child_process";
import {
  BackupError,
  requireCheck,
  canonical,
  newContext,
  sealFile,
  saveManifest,
  readManifest,
  verifyFile,
  digestFile,
} from "./core";
import { restrict } from "./workspace";
import {
  runTool,
  inspectSource,
  sourceTarget,
  pgEnvironment,
  expectedTables,
  validateToc,
} from "./postgres";
import { STRICT, MANAGED } from "./policy";
import { BackupKey, KeyRing } from "./keys";
import { decryptToPrivateFile } from "./decrypt";
import { restoreFixture } from "./restore-fixture";
import { sourceProfile, type SourceRelease } from "./source-profile";
import { reviewedRollback008 } from "../db/migration-checksum";
import { profilePrivilegeFixture } from "./profile-fixture";
import { seedBackupFinance } from "./finance-data-fixture";

const serverBin = resolve(".data/tools/postgresql18-fixture-server/bin");
const clientBin = resolve(".data/tools/postgresql18-client");
const suffix = process.platform === "win32" ? ".exe" : "";
const serverTool = (name: string) => join(serverBin, name + suffix);
const clientTool = (name: string) => join(clientBin, name + suffix);
const sha = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
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
async function insert(
  db: Client,
  table: string,
  values: Record<string, unknown>,
) {
  const cols = Object.keys(values);
  requireCheck(
    [table, ...cols].every((s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s)),
    "UNSAFE_SEED_IDENTIFIER",
  );
  await db.query(
    `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(values),
  );
}
async function seed(db: Client, restoring = false) {
  const defaultActor = "e21b-fictional-user";
  if (!restoring)
    await insert(db, "AuthUser", {
      id: defaultActor,
      name: "Imaginary E21b Operator",
      email: "e21b@example.invalid",
      updatedAt: new Date(),
    });
  await db.query("BEGIN");
  try {
    for (let i = 0; i < 2; i++) {
      const tenantId = randomUUID(),
        legalEntityId = randomUUID(),
        customerId = randomUUID(),
        materialId = randomUUID(),
        variantId = randomUUID(),
        productId = randomUUID(),
        saleId = randomUUID();
      const scope = { tenantId, legalEntityId };
      const actor = restoring ? "e23-fictional-user-" + i : defaultActor;
      if (restoring) {
        await insert(db, "AuthUser", {
          id: actor,
          name: "Imaginary Restore User " + i,
          email: `e23-${i}@example.invalid`,
          updatedAt: new Date(),
          twoFactorEnabled: false,
        });
        await insert(db, "AuthAccount", {
          id: randomUUID(),
          accountId: actor,
          providerId: "credential",
          userId: actor,
          password: "SYNTHETIC-NOT-A-REAL-HASH",
          updatedAt: new Date(),
        });
        await insert(db, "AuthSession", {
          id: randomUUID(),
          token: "SYNTHETIC-EXPIRED-SESSION-" + i,
          userId: actor,
          expiresAt: new Date("2000-01-01T00:00:00Z"),
          updatedAt: new Date(),
        });
        await insert(db, "AuthTwoFactor", {
          id: randomUUID(),
          userId: actor,
          secret: "SYNTHETIC-NOT-A-REAL-TOTP",
          backupCodes: "SYNTHETIC-NOT-RECOVERY-CODES",
          verified: false,
        });
        await insert(db, "AuthSecurityEvent", {
          id: randomUUID(),
          userId: actor,
          action: "SYNTHETIC_RESTORE_FIXTURE",
        });
      }
      await insert(db, "Tenant", {
        id: tenantId,
        name: `Imaginary Tenant ${i}`,
      });
      await insert(db, "LegalEntity", {
        tenantId,
        id: legalEntityId,
        name: `Imaginary Company ${i}`,
      });
      if (restoring) {
        await insert(db, "Membership", {
          id: randomUUID(),
          tenantId,
          userId: actor,
        });
        await insert(db, "AuditEvent", {
          id: randomUUID(),
          tenantId,
          legalEntityId,
          actorId: actor,
          targetId: tenantId,
          action: "SYNTHETIC_RESTORE_FIXTURE",
          summary: { fixture: true },
        });
      }
      await insert(db, "Customer", {
        ...scope,
        id: customerId,
        sourceId: `e21b-customer-${i}`,
        name: `Imaginary Customer ${i}`,
      });
      await insert(db, "Material", {
        ...scope,
        id: materialId,
        name: `Imaginary Material ${i}`,
        unit: "square_meter",
      });
      await insert(db, "MaterialVariant", {
        ...scope,
        id: variantId,
        materialId,
        name: "Synthetic 152cm",
        widthCm: "152.0000",
        usdCost: "1.250000",
      });
      await insert(db, "MaterialPriceHistory", {
        ...scope,
        id: randomUUID(),
        variantId,
        previousUsd: "1.000000",
        nextUsd: "1.250000",
        actorId: actor,
      });
      await insert(db, "CloudProduct", {
        ...scope,
        id: productId,
        createdById: actor,
        sourceId: `e21b-product-${i}`,
        name: "Synthetic print",
        unit: "m2",
        kind: "print",
      });
      const amounts = {
        costUsd: "2.500000",
        netUsd: "5.000000",
        netTry: "250.00",
        vatTry: "50.00",
        totalTry: "300.00",
      };
      const snapshot = {
        fixture: true,
        usdUnitCost: "1.250000",
        usdTry: "50.000000",
      };
      await insert(db, "CloudQuote", {
        ...scope,
        ...amounts,
        id: randomUUID(),
        createdById: actor,
        customerId,
        groupId: randomUUID(),
        revision: 1,
        title: "Imaginary quote",
        idempotencyKey: randomUUID(),
        payloadHash: sha("imaginary quote"),
        snapshot,
      });
      await insert(db, "CloudSale", {
        ...scope,
        ...amounts,
        id: saleId,
        createdById: actor,
        customerId,
        idempotencyKey: randomUUID(),
        payloadHash: sha("imaginary sale"),
        date: "2026-10-18",
        dueDate: "2026-11-18",
        currency: "TRY",
        notes: "SYNTHETIC ONLY",
        rateSnapshot: snapshot,
      });
      await insert(db, "CloudSaleLine", {
        ...scope,
        ...amounts,
        id: randomUUID(),
        saleId,
        productId,
        description: "Synthetic line",
        quantity: "2.000000",
        widthCm: "100.0000",
        heightCm: "100.0000",
        discount: "0",
        vat: "20",
        snapshot,
      });
      await insert(db, "CloudPaymentPlan", {
        ...scope,
        id: randomUUID(),
        saleId,
        dueDate: "2026-11-18",
        method: "cash",
        amount: "300.00",
      });
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
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
  const selected = process.argv
    .find((a) => a.startsWith("--source-profile="))
    ?.split("=")[1] as SourceRelease | undefined;
  const profile = selected ? sourceProfile(selected) : undefined;
  const managed = process.argv.includes("--managed-neon-fixture");
  const restoring = process.argv.includes("--restore-fixture");
  requireCheck(!selected || restoring, "BACKUP_PROFILE_RESTORE_REQUIRED");
  requireCheck(!managed || !restoring, "FIXTURE_MODE_CONFLICT");
  const securityPolicy = managed ? MANAGED : STRICT;
  requireCheck(
    process.argv.includes("--approve-local-fixture"),
    "LOCAL_FIXTURE_APPROVAL_REQUIRED",
  );
  requireCheck(process.platform === "win32", "WINDOWS_FIXTURE_ONLY");
  const archive = resolve(
    ".data/tools/downloads/postgresql-18.6-5-windows-x64-binaries.zip",
  );
  // This archive is larger than the backup format's limit? No: < 4 GiB.
  requireCheck(
    (await digestFile(archive)).sha256 ===
      "e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2",
    "SERVER_ARCHIVE_PIN_MISMATCH",
  );
  const root = resolve(".data/fixtures");
  await mkdir(root, { recursive: true, mode: 0o700 });
  requireCheck(
    !(await lstat(root)).isSymbolicLink() && (await realpath(root)) === root,
    "FIXTURE_ROOT_REJECTED",
  );
  const dir = join(
    root,
    `${restoring ? "e23" : managed ? "e22d" : "e21b"}-${randomUUID()}`,
  );
  await mkdir(dir, { mode: 0o700 });
  await restrict(dir);
  const data = join(dir, "data"),
    passwordFile = join(dir, "init-password.tmp");
  const adminPassword = randomBytes(32).toString("hex"),
    backupPassword = randomBytes(32).toString("hex"),
    readerPassword = randomBytes(32).toString("hex");
  const material = BackupKey.generate();
  const key = material.use((k) => Buffer.from(k)),
    keyId = material.keyId;
  material.dispose();
  const port = await freePort(55432);
  let startAttempted = false,
    stopped = false,
    observedIdentity: { pid: number; created: unknown } | undefined;
  let admin: Client | undefined,
    snapshot: Awaited<ReturnType<typeof inspectSource>> | undefined;
  let failure: string | undefined;
  const report: Record<string, unknown> = {
    fixtureId: dir.split(/[\\/]/).at(-1),
    host: "127.0.0.1",
    port,
    dataDirectory: data,
    realNeonConnection: false,
    r2Operations: false,
    auth: "scram-sha-256",
    securityPolicy,
    versions: {},
    results,
  };
  try {
    const versions: Record<string, string> = {};
    for (const name of [
      "postgres",
      "initdb",
      "pg_ctl",
      "pg_dump",
      "pg_restore",
      "psql",
    ]) {
      versions[name] = (
        await runTool(
          ["postgres", "initdb", "pg_ctl"].includes(name)
            ? serverTool(name)
            : clientTool(name),
          ["--version"],
          safeEnv,
        )
      ).trim();
      requireCheck(versions[name].endsWith("18.6"), "PG186_REQUIRED");
    }
    report.versions = versions;
    pass("server-and-client-18.6");
    await writeFile(passwordFile, adminPassword + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    await runTool(
      serverTool("initdb"),
      [
        "-D",
        data,
        "-U",
        "fixture_admin",
        "--auth-host=scram-sha-256",
        "--auth-local=scram-sha-256",
        "--pwfile=" + passwordFile,
        "--encoding=UTF8",
        "--locale=C",
      ],
      safeEnv,
      120000,
    );
    await rm(passwordFile);
    await writeFile(
      join(data, "pg_hba.conf"),
      "host all all 127.0.0.1/32 scram-sha-256\n",
      "utf8",
    );
    await writeFile(
      join(data, "postgresql.auto.conf"),
      `listen_addresses = '127.0.0.1'\nport = ${port}\npassword_encryption = 'scram-sha-256'\nssl = off\nlog_statement = 'none'\nlog_min_error_statement = 'panic'\n`,
      "utf8",
    );
    startAttempted = true;
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
    observedIdentity = await identity(data);
    report.serverPid = observedIdentity.pid;
    const connect = (
      database: string,
      user = "fixture_admin",
      password = adminPassword,
    ) =>
      new Client({
        host: "127.0.0.1",
        port,
        database,
        user,
        password,
        ssl: false,
        connectionTimeoutMillis: 5000,
        statement_timeout: 60000,
      });
    admin = connect("postgres");
    await admin.connect();
    requireCheck(
      (await admin.query("SHOW data_directory")).rows[0].data_directory
        .replaceAll("\\", "/")
        .toLowerCase() === data.replaceAll("\\", "/").toLowerCase(),
      "CONNECTED_TO_WRONG_CLUSTER",
    );
    requireCheck(
      (await admin.query("SHOW listen_addresses")).rows[0].listen_addresses ===
        "127.0.0.1",
      "NOT_LOOPBACK_ONLY",
    );
    const rules = (
      await admin.query(
        "SELECT auth_method,address,error FROM pg_hba_file_rules",
      )
    ).rows;
    requireCheck(
      rules.length === 1 &&
        rules[0].auth_method === "scram-sha-256" &&
        rules[0].address === "127.0.0.1" &&
        !rules[0].error,
      "AUTH_RULES_REJECTED",
    );
    await admin.query("CREATE DATABASE pusula_backup_fixture");
    if (managed)
      await admin.query("CREATE DATABASE pusula_backup_fixture_other");
    await admin.end();
    admin = connect("pusula_backup_fixture");
    await admin.connect();
    for (const role of [
      "pusula_runtime",
      "pusula_test_runtime",
      "pusula_auth",
      "pusula_test_auth",
    ])
      await admin.query(
        `CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
      );
    await admin.query(
      `CREATE ROLE pusula_fixture_backup LOGIN PASSWORD '${backupPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS`,
    );
    await admin.query(
      `CREATE ROLE fixture_rls_reader LOGIN PASSWORD '${readerPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    await admin.query(
      "CREATE TABLE _prisma_migrations(id varchar(36) PRIMARY KEY,checksum varchar(64) NOT NULL,finished_at timestamptz,migration_name varchar(255) NOT NULL,logs text,rolled_back_at timestamptz,started_at timestamptz NOT NULL DEFAULT now(),applied_steps_count integer NOT NULL DEFAULT 0)",
    );
    const migrations = (
      await readdir("prisma/migrations", { withFileTypes: true })
    )
      .filter((d) => d.isDirectory())
      .filter((d) => d.name <= "202610170013_sale_line_sealing")
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of migrations) {
      const sql = await readFile(
        join("prisma/migrations", entry.name, "migration.sql"),
      );
      await admin.query("BEGIN");
      try {
        await admin.query(sql.toString("utf8"));
        await admin.query(
          "INSERT INTO _prisma_migrations(id,checksum,finished_at,migration_name,applied_steps_count) VALUES($1,$2,now(),$3,1)",
          [randomUUID(), sha(sql), entry.name],
        );
        await admin.query("COMMIT");
      } catch (e) {
        await admin.query("ROLLBACK");
        throw e;
      }
    }
    await seed(admin, restoring);
    if (profile) {
      await admin.query(
        `INSERT INTO "Role"(id,name) VALUES('MASTER','Synthetic backup fixture master') ON CONFLICT(id) DO NOTHING`,
      );
      const successors = (
        await readdir("prisma/migrations", { withFileTypes: true })
      )
        .filter((d) => d.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(13, profile.migrationCount);
      for (const entry of successors) {
        const sql = await readFile(
          join("prisma/migrations", entry.name, "migration.sql"),
        );
        if (entry.name === "202610230017_finance")
          await admin.query(
            "SELECT set_config('pusula.finance_review','APPROVED_017_CANDIDATE',false)",
          );
        await admin.query(sql.toString("utf8"));
        await admin.query(
          "INSERT INTO _prisma_migrations(id,checksum,finished_at,migration_name,applied_steps_count) VALUES($1,$2,now(),$3,1)",
          [randomUUID(), sha(sql), entry.name],
        );
        migrations.push(entry);
      }
      await admin.query("RESET pusula.finance_review");
      if (selected === "post017") await seedBackupFinance(admin);
      await admin.query(
        "INSERT INTO _prisma_migrations(id,checksum,migration_name,rolled_back_at) VALUES($1,$2,'202610160008_company_metadata',now())",
        [randomUUID(), reviewedRollback008],
      );
      report.sourceProfile = selected;
    }
    if (restoring)
      await admin.query(
        'GRANT USAGE ON SCHEMA public TO pusula_runtime; GRANT SELECT ON "Tenant","LegalEntity","Activity","Customer","Material","MaterialVariant","MaterialPriceHistory" TO pusula_runtime',
      );
    await admin.query(
      (managed
        ? ""
        : "REVOKE TEMPORARY ON DATABASE pusula_backup_fixture FROM PUBLIC; ") +
        "GRANT CONNECT ON DATABASE pusula_backup_fixture TO pusula_fixture_backup,fixture_rls_reader; GRANT USAGE ON SCHEMA public TO pusula_fixture_backup,fixture_rls_reader; GRANT SELECT ON ALL TABLES IN SCHEMA public TO pusula_fixture_backup,fixture_rls_reader; GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO pusula_fixture_backup,fixture_rls_reader",
    );
    if (!managed) {
      const others = (
        await admin.query(
          "SELECT datname FROM pg_database WHERE datallowconn AND datname<>current_database() ORDER BY datname",
        )
      ).rows;
      for (const other of others) {
        requireCheck(
          ["postgres", "template1"].includes(other.datname),
          "UNEXPECTED_FIXTURE_DATABASE",
        );
        await admin.query(
          `REVOKE CONNECT ON DATABASE "${other.datname}" FROM PUBLIC`,
        );
      }
    }
    pass("isolated-scram-cluster-13-migrations-and-synthetic-records");
    const counts: Record<string, number> = {};
    for (const table of profile?.tables ?? expectedTables)
      counts[table] = Number(
        (await admin.query(`SELECT count(*) FROM "${table}"`)).rows[0].count,
      );
    for (const table of [
      "Tenant",
      "Customer",
      "Material",
      "MaterialVariant",
      "MaterialPriceHistory",
      "CloudQuote",
      "CloudSale",
      "CloudSaleLine",
      "CloudPaymentPlan",
    ])
      requireCheck(counts[table] === 2, "SYNTHETIC_RECORD_COUNTS_WRONG");
    const rel = await admin.query(
      'SELECT count(*) FROM "CloudSale" s JOIN "CloudSaleLine" l ON l."saleId"=s.id JOIN "CloudPaymentPlan" p ON p."saleId"=s.id JOIN "Customer" c ON c.id=s."customerId"',
    );
    requireCheck(Number(rel.rows[0].count) === 2, "SYNTHETIC_RELATIONS_WRONG");
    report.sourceCounts = counts;
    report.migrations = migrations.length;
    const u = sourceTarget(
      `postgresql://pusula_fixture_backup:${backupPassword}@127.0.0.1:${port}/pusula_backup_fixture?sslmode=disable`,
      true,
    );
    if (selected) await profilePrivilegeFixture(admin, u, selected, pass);
    if (managed) {
      const blocked = async (name: string, code: string) => {
        let opened: Awaited<ReturnType<typeof inspectSource>> | undefined;
        try {
          opened = await inspectSource(u, MANAGED);
        } catch (e) {
          requireCheck(
            e instanceof BackupError && e.code === code,
            "PREFLIGHT_NEGATIVE_UNEXPECTED_ERROR",
          );
          pass(name);
          return;
        } finally {
          if (opened) {
            await opened.db.query("ROLLBACK");
            await opened.db.end();
          }
        }
        throw new BackupError("PREFLIGHT_DRIFT_NOT_BLOCKED");
      };
      await admin.query("ALTER ROLE pusula_fixture_backup CREATEROLE");
      try {
        await blocked(
          "managed-role-attribute-drift-blocked",
          "BACKUP_ROLE_REJECTED",
        );
      } finally {
        await admin.query("ALTER ROLE pusula_fixture_backup NOCREATEROLE");
      }
      await admin.query(
        "CREATE ROLE fixture_escalation NOLOGIN; GRANT fixture_escalation TO pusula_fixture_backup",
      );
      try {
        await blocked(
          "managed-role-membership-drift-blocked",
          "SOURCE_ROLE_MEMBERSHIP_REJECTED",
        );
      } finally {
        await admin.query(
          "REVOKE fixture_escalation FROM pusula_fixture_backup; DROP ROLE fixture_escalation",
        );
      }
      await admin.query('GRANT UPDATE ON "Tenant" TO pusula_fixture_backup');
      try {
        await blocked(
          "managed-source-write-grant-drift-blocked",
          "SOURCE_OBJECT_OR_PRIVILEGE_REJECTED",
        );
      } finally {
        await admin.query(
          'REVOKE UPDATE ON "Tenant" FROM pusula_fixture_backup',
        );
      }
      await admin.query("CREATE SEQUENCE fixture_sequence");
      const b = connect(
        "pusula_backup_fixture",
        "pusula_fixture_backup",
        backupPassword,
      );
      await b.connect();
      const denied = async (name: string, sql: string, code = "42501") => {
        try {
          await b.query(sql);
        } catch (e) {
          requireCheck(
            (e as { code: string }).code === code,
            "PERMISSION_TEST_UNEXPECTED_ERROR",
          );
          pass(name);
          return;
        }
        throw new BackupError("PERMISSION_TEST_DID_NOT_FAIL");
      };
      try {
        const lo = Number(
          (await b.query("SELECT lo_create(0) AS oid")).rows[0].oid,
        );
        requireCheck(
          Number.isInteger(lo) && lo > 0,
          "LARGE_OBJECT_RISK_NOT_OBSERVED",
        );
        try {
          requireCheck(
            (
              await b.query(
                "SELECT lomowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned FROM pg_largeobject_metadata WHERE oid=$1",
                [lo],
              )
            ).rows[0].owned === true,
            "LARGE_OBJECT_OWNERSHIP_NOT_OBSERVED",
          );
          pass("managed-public-builtin-can-create-owned-large-object");
          await blocked(
            "managed-large-object-ownership-preflight-blocked",
            "SOURCE_OBJECT_OWNER_REJECTED",
          );
        } finally {
          requireCheck(
            (await b.query("SELECT lo_unlink($1) AS removed", [lo])).rows[0]
              .removed === 1,
            "FIXTURE_LARGE_OBJECT_CLEANUP_FAILED",
          );
        }
        await denied(
          "managed-sequence-nextval-denied",
          "SELECT nextval('fixture_sequence')",
        );
        await admin.query("DROP SEQUENCE fixture_sequence");
        requireCheck(
          Number(
            (await b.query('SELECT count(*) FROM "Tenant"')).rows[0].count,
          ) === 2,
          "FORCE_RLS_FILTERED",
        );
        pass("managed-bypass-select-both-tenants");
        for (const [name, sql] of [
          [
            "insert",
            "INSERT INTO \"Tenant\"(id,name) VALUES(gen_random_uuid(),'imaginary denied')",
          ],
          ["update", "UPDATE \"Tenant\" SET name='denied'"],
          ["delete", 'DELETE FROM "Tenant"'],
          ["create", "CREATE TABLE public.denied(id int)"],
          ["alter", 'ALTER TABLE "Tenant" ADD COLUMN denied int'],
          ["drop", 'DROP TABLE "Tenant"'],
          ["set-role", "SET ROLE fixture_admin"],
          ["grant-role", "GRANT fixture_admin TO pusula_fixture_backup"],
          ["create-role", "CREATE ROLE denied_role"],
          ["auth-function", "SELECT pusula_can('read',NULL,NULL,NULL,NULL)"],
        ])
          await denied("managed-" + name + "-denied", sql);
        requireCheck(
          (
            await b.query(
              "SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)",
            )
          ).rows[0].n === 0,
          "APP_OWNERSHIP",
        );
        pass("managed-no-application-ownership");
        requireCheck(
          (
            await b.query(
              "SELECT has_function_privilege('reject_audit_event_change()','EXECUTE') AS allowed",
            )
          ).rows[0].allowed === true,
          "PUBLIC_EXECUTE_NOT_OBSERVED",
        );
        await denied(
          "managed-public-trigger-not-directly-callable",
          "SELECT reject_audit_event_change()",
          "0A000",
        );
        await b.query("CREATE TEMP TABLE ephemeral_owned(id int)");
        await b.query("INSERT INTO ephemeral_owned VALUES(1)");
        await b.query("ALTER TABLE ephemeral_owned ADD COLUMN label text");
        await b.query("DROP TABLE ephemeral_owned");
        pass("managed-public-temp-allows-own-temp-ddl-dml");
      } finally {
        await b.end();
      }
      const otherAdmin = connect("pusula_backup_fixture_other");
      await otherAdmin.connect();
      try {
        await otherAdmin.query(
          "CREATE TABLE private_data(secret text); INSERT INTO private_data VALUES('imaginary-only')",
        );
        const other = connect(
          "pusula_backup_fixture_other",
          "pusula_fixture_backup",
          backupPassword,
        );
        await other.connect();
        try {
          pass("managed-public-connect-opens-other-database");
          try {
            await other.query("SELECT * FROM private_data");
            throw new BackupError("OTHER_DATA_UNEXPECTEDLY_READABLE");
          } catch (e) {
            requireCheck(
              (e as { code: string }).code === "42501",
              "OTHER_DATA_NOT_DENIED",
            );
          }
          pass("managed-other-private-select-denied");
          await otherAdmin.query(
            "CREATE FUNCTION public.leak_demo() RETURNS text LANGUAGE sql SECURITY DEFINER AS 'SELECT secret FROM public.private_data LIMIT 1'",
          );
          requireCheck(
            (await other.query("SELECT public.leak_demo() AS value")).rows[0]
              .value === "imaginary-only",
            "DEFINER_RISK_NOT_REPRODUCED",
          );
          pass("managed-public-definer-can-leak-other-db-data");
          try {
            await inspectSource(u, MANAGED);
            throw new BackupError("DRIFT_NOT_BLOCKED");
          } catch (e) {
            requireCheck(
              e instanceof BackupError &&
                e.code === "MANAGED_OTHER_DATABASE_OBJECT_ACCESS_REJECTED",
              "WRONG_DRIFT_ERROR",
            );
          }
          pass("managed-definer-drift-preflight-blocked");
          await otherAdmin.query("DROP FUNCTION public.leak_demo()");
          await otherAdmin.query("GRANT SELECT ON private_data TO PUBLIC");
          requireCheck(
            (await other.query("SELECT secret FROM private_data")).rowCount ===
              1,
            "FUTURE_PUBLIC_SELECT_NOT_OBSERVED",
          );
          pass("managed-future-public-select-can-leak-other-db-data");
          try {
            await inspectSource(u, MANAGED);
            throw new BackupError("DRIFT_NOT_BLOCKED");
          } catch (e) {
            requireCheck(
              e instanceof BackupError &&
                e.code === "MANAGED_OTHER_DATABASE_OBJECT_ACCESS_REJECTED",
              "WRONG_DRIFT_ERROR",
            );
          }
          pass("managed-public-select-drift-preflight-blocked");
          await otherAdmin.query("REVOKE SELECT ON private_data FROM PUBLIC");
          await otherAdmin.query(
            "GRANT SELECT(secret) ON private_data TO PUBLIC",
          );
          requireCheck(
            (await other.query("SELECT secret FROM private_data")).rowCount ===
              1,
            "PUBLIC_COLUMN_SELECT_NOT_OBSERVED",
          );
          pass("managed-public-column-select-can-leak-other-db-data");
          await blocked(
            "managed-column-select-drift-preflight-blocked",
            "MANAGED_OTHER_DATABASE_OBJECT_ACCESS_REJECTED",
          );
          await otherAdmin.query(
            "REVOKE SELECT(secret) ON private_data FROM PUBLIC",
          );
        } finally {
          await other.end();
        }
      } finally {
        await otherAdmin.end();
      }
      try {
        await inspectSource(u);
        throw new BackupError("STRICT_ACCEPTED_TEMP");
      } catch (e) {
        requireCheck(
          e instanceof BackupError &&
            e.code === "SOURCE_TEMP_PRIVILEGE_REJECTED",
          "STRICT_DEFAULT_WRONG_ERROR",
        );
      }
      pass("strict-default-still-blocks-public-temp");
    }
    snapshot = await inspectSource(u, securityPolicy, selected);
    report.databaseAccess = snapshot.databaseAccess;
    pass(
      `real-backup-role-${snapshot.tables}-tables-profile-${selected ?? "legacy"}-and-snapshot`,
    );
    const dump = join(dir, "fixture.dump"),
      env = { ...pgEnvironment(u), NODE_ENV: "test" as const };
    await runTool(
      clientTool("pg_dump"),
      [
        "-Fc",
        "--no-password",
        "--snapshot=" + snapshot.snapshot,
        "--file=" + dump,
      ],
      env,
      120000,
    );
    const toc = await runTool(
      clientTool("pg_restore"),
      ["--list", dump],
      safeEnv,
    );
    validateToc(toc, profile?.tables);
    const catalogGroups = [
      {
        name: "foreignKeys",
        kind: "FK CONSTRAINT",
        sql: "SELECT t.relname AS table_name,c.conname AS object_name FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.contype='f' AND n.nspname='public'",
      },
      {
        name: "policies",
        kind: "POLICY",
        sql: "SELECT t.relname AS table_name,p.polname AS object_name FROM pg_policy p JOIN pg_class t ON t.oid=p.polrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public'",
      },
      {
        name: "triggers",
        kind: "TRIGGER",
        sql: "SELECT t.relname AS table_name,g.tgname AS object_name FROM pg_trigger g JOIN pg_class t ON t.oid=g.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE NOT g.tgisinternal AND n.nspname='public'",
      },
    ];
    const objectCounts: Record<string, number> = {};
    for (const group of catalogGroups) {
      const expected = (await admin.query(group.sql)).rows
        .map((r) => [r.table_name, r.object_name])
        .sort();
      const matches = [
        ...toc.matchAll(
          new RegExp(
            `^\\d+; \\d+ \\d+ ${group.kind} public (\\S+) (\\S+) `,
            "gm",
          ),
        ),
      ]
        .map((m) => [m[1].replace(/^"|"$/g, ""), m[2].replace(/^"|"$/g, "")])
        .sort();
      requireCheck(
        expected.length > 0 && canonical(expected) === canonical(matches),
        "ARCHIVE_RELATIONAL_OBJECTS_MISMATCH",
      );
      objectCounts[group.name] = expected.length;
    }
    report.relationalObjects = objectCounts;
    pass("all-foreign-keys-policies-and-user-triggers-in-archive");
    await writeFile(join(dir, "archive-toc.txt"), toc, { mode: 0o600 });
    pass("real-pg-dump-custom-and-pg-restore-list-full-coverage");
    const sqlPath = join(dir, "archive-data.sql");
    await runTool(
      clientTool("pg_restore"),
      ["--data-only", "--file=" + sqlPath, dump],
      safeEnv,
    );
    const sql = await readFile(sqlPath, "utf8"),
      copied: Record<string, number> = {};
    for (const m of sql.matchAll(
      /^COPY public\."?([A-Za-z_][A-Za-z0-9_]*)"? \([^\n]+\) FROM stdin;\r?\n([\s\S]*?)^\\\.\r?$/gm,
    ))
      copied[m[1]] = m[2].trimEnd() ? m[2].trimEnd().split(/\r?\n/).length : 0;
    requireCheck(
      canonical(copied) === canonical(counts),
      "ARCHIVE_ROW_COUNTS_MISMATCH",
    );
    pass(
      `all-${Object.keys(counts).length}-table-copy-row-counts-match-source`,
    );
    const ctx = newContext({
      sourceEnvironment: "fixture",
      databaseVersion: snapshot.version,
      schemaVersion: snapshot.schemaVersion,
      coverageSha256: snapshot.coverageSha256,
      keyId,
      securityPolicy,
    });
    const cipher = join(dir, "archive.gcm"),
      manifest = await sealFile(dump, cipher, ctx, key);
    await saveManifest(join(dir, "manifest.json"), manifest);
    const verified = await verifyFile(cipher, manifest, key, keyId);
    requireCheck(
      verified.plaintextSha256 === (await digestFile(dump)).sha256 &&
        verified.plaintextSize === (await digestFile(dump)).size,
      "DECRYPTED_DUMP_HASH_MISMATCH",
    );
    report.ciphertextBytes = manifest.ciphertextSize;
    report.ciphertextSha256 = manifest.ciphertextSha256;
    pass("aes-256-gcm-decrypt-plaintext-sha256-and-manifest");
    async function reject(
      name: string,
      fn: () => Promise<unknown>,
      expected: string,
    ) {
      try {
        await fn();
      } catch (e) {
        requireCheck(
          e instanceof BackupError && e.code === expected,
          "NEGATIVE_TEST_UNEXPECTED_ERROR",
        );
        pass(name);
        return;
      }
      throw new BackupError("NEGATIVE_TEST_DID_NOT_FAIL");
    }
    const wrongKey = randomBytes(32);
    try {
      await reject(
        "wrong-key-rejected",
        () => verifyFile(cipher, manifest, wrongKey, keyId),
        "MANIFEST_AUTH_FAILED",
      );
    } finally {
      wrongKey.fill(0);
    }
    await reject(
      "tampered-manifest-rejected",
      () =>
        verifyFile(
          cipher,
          { ...manifest, ciphertextSha256: "0".repeat(64) },
          key,
          keyId,
        ),
      "MANIFEST_AUTH_FAILED",
    );
    const corrupt = await readFile(cipher);
    corrupt[0] ^= 1;
    await writeFile(join(dir, "corrupt.gcm"), corrupt, { mode: 0o600 });
    await reject(
      "corrupt-ciphertext-rejected",
      () => verifyFile(join(dir, "corrupt.gcm"), manifest, key, keyId),
      "CIPHERTEXT_MISMATCH",
    );
    await reject(
      "pg-dump-wrong-password-nonzero",
      () =>
        runTool(
          clientTool("pg_dump"),
          [
            "-Fc",
            "--no-password",
            "--file=" + join(dir, "wrong-password.dump"),
          ],
          { ...env, PGPASSWORD: randomBytes(32).toString("hex") },
        ),
      "TOOL_FAILED",
    );
    await reject(
      "pg-dump-non-bypass-rls-nonzero",
      () =>
        runTool(
          clientTool("pg_dump"),
          ["-Fc", "--no-password", "--file=" + join(dir, "rls-filtered.dump")],
          { ...env, PGUSER: "fixture_rls_reader", PGPASSWORD: readerPassword },
        ),
      "TOOL_FAILED",
    );
    await writeFile(join(dir, "invalid.dump"), "not-a-postgresql-archive");
    await reject(
      "pg-restore-invalid-archive-nonzero",
      () =>
        runTool(
          clientTool("pg_restore"),
          ["--list", join(dir, "invalid.dump")],
          safeEnv,
        ),
      "TOOL_FAILED",
    );
    if (restoring) {
      const ring = new KeyRing();
      ring.add(new BackupKey(keyId, key), true);
      try {
        const next = ring.rotate();
        const rotated = await ring.active().use((k) =>
          sealFile(
            dump,
            join(dir, "rotated.gcm"),
            newContext({
              sourceEnvironment: "fixture",
              databaseVersion: snapshot!.version,
              schemaVersion: snapshot!.schemaVersion,
              coverageSha256: snapshot!.coverageSha256,
              keyId: next,
              securityPolicy,
            }),
            k,
          ),
        );
        await ring
          .get(keyId)
          .use((k) => verifyFile(cipher, manifest, k, keyId));
        await ring
          .get(next)
          .use((k) => verifyFile(join(dir, "rotated.gcm"), rotated, k, next));
        pass("key-rotation-old-and-new-archive-readability");
        await reject(
          "rotated-key-cannot-decrypt-old-archive",
          () =>
            ring.get(next).use((k) => verifyFile(cipher, manifest, k, keyId)),
          "MANIFEST_AUTH_FAILED",
        );
        await reject(
          "old-key-cannot-decrypt-rotated-archive",
          () =>
            ring
              .get(keyId)
              .use((k) =>
                verifyFile(join(dir, "rotated.gcm"), rotated, k, next),
              ),
          "MANIFEST_AUTH_FAILED",
        );
        await reject(
          "missing-key-fails-closed",
          async () => ring.get("missing-fixture-key"),
          "BACKUP_KEY_NOT_FOUND",
        );
        await reject(
          "missing-manifest-blocks-decrypt",
          async () =>
            decryptToPrivateFile(
              cipher,
              await readManifest(join(dir, "manifest-not-present.json")),
              key,
              keyId,
              dir,
            ),
          "MANIFEST_MISSING_OR_INVALID",
        );
        const wrongRestoreKey = randomBytes(32);
        try {
          await reject(
            "wrong-key-blocks-decrypt-before-restore",
            () =>
              decryptToPrivateFile(
                cipher,
                manifest,
                wrongRestoreKey,
                keyId,
                dir,
              ),
            "MANIFEST_AUTH_FAILED",
          );
        } finally {
          wrongRestoreKey.fill(0);
        }
        await reject(
          "corrupt-archive-blocks-decrypt-before-restore",
          () =>
            decryptToPrivateFile(
              join(dir, "corrupt.gcm"),
              manifest,
              key,
              keyId,
              dir,
            ),
          "CIPHERTEXT_MISMATCH",
        );
        const decrypted = await decryptToPrivateFile(
          cipher,
          manifest,
          key,
          keyId,
          dir,
        );
        requireCheck(
          (await digestFile(decrypted)).sha256 ===
            (await digestFile(dump)).sha256,
          "RESTORE_DECRYPT_HASH_MISMATCH",
        );
        pass("authenticated-decrypted-dump-written-to-private-fixture-only");
        report.restore = await restoreFixture({
          source: admin,
          connect,
          dataDirectory: data,
          directory: dir,
          decrypted,
          pgRestore: clientTool("pg_restore"),
          environment: { ...env, PGPASSWORD: adminPassword },
          readerPassword,
          backupPassword,
          pass,
          tables: profile?.tables,
        });
      } finally {
        ring.dispose();
      }
    }
  } catch (e) {
    failure = e instanceof BackupError ? e.code : "LOCAL_FIXTURE_FAILED";
    report.failureCode = failure;
    report.functionDrift = (e as { functionDrift?: unknown }).functionDrift;
    report.databaseErrorCode = /^[A-Z0-9]{5}$/.test(
      (e as { code?: string }).code ?? "",
    )
      ? (e as { code: string }).code
      : undefined;
  } finally {
    key.fill(0);
    if (snapshot) {
      await snapshot.db.query("ROLLBACK").catch(() => {});
      await snapshot.db.end().catch(() => {});
    }
    if (admin) await admin.end().catch(() => {});
    await rm(passwordFile, { force: true });
    if (startAttempted) {
      try {
        const confirmed = await identity(data);
        requireCheck(
          !observedIdentity ||
            (confirmed.pid === observedIdentity.pid &&
              confirmed.created === observedIdentity.created),
          "FIXTURE_PID_CHANGED",
        );
        await control(["stop", "-D", data, "-m", "fast", "-w", "-t", "45"]);
        try {
          await readFile(join(data, "postmaster.pid"));
          throw new BackupError("FIXTURE_PID_FILE_REMAINS");
        } catch (e) {
          requireCheck(
            (e as NodeJS.ErrnoException).code === "ENOENT",
            "FIXTURE_PID_FILE_REMAINS",
          );
        }
        const status = await runTool(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${confirmed.pid}'; if($p){'PRESENT'}else{'ABSENT'}`,
          ],
          safeEnv,
        );
        requireCheck(status.trim() === "ABSENT", "FIXTURE_PROCESS_REMAINS");
        stopped = true;
        report.serverPid = confirmed.pid;
        pass("exact-pid-directory-process-stopped");
      } catch (e) {
        failure = e instanceof BackupError ? e.code : "FIXTURE_STOP_FAILED";
        report.shutdownError = failure;
      }
    }
    report.serverStopped = stopped;
    report.status = failure ? "FAIL" : "PASS";
    const rel = relative(root, dir);
    requireCheck(
      !isAbsolute(rel) && /^e(?:21b|22d|23)-[a-f0-9-]{36}$/.test(rel),
      "REPORT_TARGET_REJECTED",
    );
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
        checks: results.length,
        failureCode: failure ?? null,
      }),
    );
  }
  if (failure) process.exitCode = 1;
}
main().catch((e) => {
  console.log(
    JSON.stringify({
      status: "FAIL",
      code: e instanceof BackupError ? e.code : "LOCAL_FIXTURE_SETUP_FAILED",
    }),
  );
  process.exitCode = 1;
});
