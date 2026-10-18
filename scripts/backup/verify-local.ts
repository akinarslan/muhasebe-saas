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
async function seed(db: Client) {
  const actor = "e21b-fictional-user";
  await insert(db, "AuthUser", {
    id: actor,
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
      await insert(db, "Tenant", {
        id: tenantId,
        name: `Imaginary Tenant ${i}`,
      });
      await insert(db, "LegalEntity", {
        tenantId,
        id: legalEntityId,
        name: `Imaginary Company ${i}`,
      });
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
  const dir = join(root, `e21b-${randomUUID()}`);
  await mkdir(dir, { mode: 0o700 });
  await restrict(dir);
  const data = join(dir, "data"),
    passwordFile = join(dir, "init-password.tmp");
  const adminPassword = randomBytes(32).toString("hex"),
    backupPassword = randomBytes(32).toString("hex"),
    readerPassword = randomBytes(32).toString("hex");
  const key = randomBytes(32),
    keyId = "ephemeral-e21b";
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
    await seed(admin);
    await admin.query(
      "REVOKE TEMPORARY ON DATABASE pusula_backup_fixture FROM PUBLIC; GRANT CONNECT ON DATABASE pusula_backup_fixture TO pusula_fixture_backup,fixture_rls_reader; GRANT USAGE ON SCHEMA public TO pusula_fixture_backup,fixture_rls_reader; GRANT SELECT ON ALL TABLES IN SCHEMA public TO pusula_fixture_backup,fixture_rls_reader; GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO pusula_fixture_backup,fixture_rls_reader",
    );
    pass("isolated-scram-cluster-13-migrations-and-synthetic-records");
    const counts: Record<string, number> = {};
    for (const table of expectedTables)
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
    snapshot = await inspectSource(u);
    pass("real-backup-role-35-tables-21-forced-rls-and-snapshot");
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
    validateToc(toc);
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
    pass("all-35-table-copy-row-counts-match-source");
    const ctx = newContext({
      sourceEnvironment: "fixture",
      databaseVersion: snapshot.version,
      schemaVersion: snapshot.schemaVersion,
      coverageSha256: snapshot.coverageSha256,
      keyId,
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
  } catch (e) {
    failure = e instanceof BackupError ? e.code : "LOCAL_FIXTURE_FAILED";
    report.failureCode = failure;
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
      !isAbsolute(rel) && /^e21b-[a-f0-9-]{36}$/.test(rel),
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
