// Phase 016 is deliberately separate from the unchanged cloud migration runner.
// No env loading on import; this sprint exposes only verified loopback fixtures.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "pg";
import {
  catalog,
  check,
  hash,
  migrationClient,
  migrationFiles,
  migrationTarget,
  MigrationSafetyError,
} from "../db/migration-safety";
import { runPrisma } from "../db/migrate";

export const stockMigration = "202610210016_goods_receipts";
export const stockChecksum =
  "80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18";
export type AclPins = { pre: string; post: string };
export function requireAclPins(pins: unknown): asserts pins is AclPins {
  const p = pins as Partial<AclPins> | null;
  check(
    p &&
      typeof p.pre === "string" &&
      typeof p.post === "string" &&
      /^[a-f0-9]{64}$/.test(p.pre) &&
      /^[a-f0-9]{64}$/.test(p.post),
    "STOCK_ACL_PIN_REQUIRED",
  );
}

export function requireLocalGate(args: string[], env: NodeJS.ProcessEnv) {
  check(
    args.every((a) =>
      ["--test", "--apply", "--approve-local-fixture"].includes(a),
    ),
    "STOCK_UNKNOWN_ARGUMENT",
  );
  // No flag, env variable or recovery name can unlock a remote connection here.
  check(
    args.includes("--test") &&
      !!env.PUSULA_LOCAL_FIXTURE &&
      env.PUSULA_DB_TARGET === "test",
    "STOCK_CLOUD_APPROVAL_REQUIRED",
  );
  check(
    !args.includes("--apply") || args.includes("--approve-local-fixture"),
    "STOCK_LOCAL_APPROVAL_REQUIRED",
  );
  check(!env.PUSULA_MIGRATION_FIXTURE_DIR, "STOCK_FIXTURE_OVERRIDE_REJECTED");
}

// Effective grants, grant options, column ACLs, ownership, default ACLs, role
// memberships/attributes and seeded permissions. OIDs/passwords/data never escape.
export async function stockSecurity(db: Client) {
  const queries = {
    roles: `SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolinherit,rolconfig FROM pg_roles WHERE rolname LIKE 'pusula%' ORDER BY 1`,
    members: `SELECT pg_get_userbyid(roleid) parent,pg_get_userbyid(member) member,admin_option,inherit_option,set_option FROM pg_auth_members WHERE pg_get_userbyid(roleid) LIKE 'pusula%' OR pg_get_userbyid(member) LIKE 'pusula%' ORDER BY 1,2`,
    database: `SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=(SELECT oid FROM pg_roles WHERE rolname=current_user) THEN '<owner>' ELSE pg_get_userbyid(a.grantee) END grantee,a.privilege_type,a.is_grantable FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database() ORDER BY 1,2`,
    tables: `SELECT c.relname,CASE WHEN c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) THEN '<owner>' ELSE pg_get_userbyid(c.relowner) END owner,CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=(SELECT oid FROM pg_roles WHERE rolname=current_user) THEN '<owner>' ELSE pg_get_userbyid(a.grantee) END grantee,a.privilege_type,a.is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY 1,3,4`,
    columns: `SELECT c.relname,x.attname,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,a.privilege_type,a.is_grantable FROM pg_attribute x JOIN pg_class c ON c.oid=x.attrelid CROSS JOIN LATERAL aclexplode(x.attacl) a WHERE c.relnamespace='public'::regnamespace ORDER BY 1,2,3,4`,
    functions: `SELECT p.oid::regprocedure::text identity,CASE WHEN p.proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) THEN '<owner>' ELSE pg_get_userbyid(p.proowner) END owner,CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=(SELECT oid FROM pg_roles WHERE rolname=current_user) THEN '<owner>' ELSE pg_get_userbyid(a.grantee) END grantee,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='public'::regnamespace ORDER BY 1,3,4`,
    schema: `SELECT n.nspname,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,a.privilege_type,a.is_grantable FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public' ORDER BY 1,2,3`,
    defaults: `SELECT CASE WHEN d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user) THEN '<owner>' ELSE pg_get_userbyid(d.defaclrole) END owner,d.defaclnamespace::regnamespace::text ns,d.defaclobjtype,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,a.privilege_type,a.is_grantable FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a ORDER BY 1,2,3,4,5`,
    permissions: `SELECT id,label,module FROM public."Permission" ORDER BY id`,
    rolePermissions: `SELECT "roleId","permissionId" FROM public."RolePermission" ORDER BY 1,2`,
  };
  const result: Record<string, unknown> = {};
  // One client, one snapshot; intentionally sequential queries.
  for (const [key, sql] of Object.entries(queries))
    result[key] = (await db.query(sql)).rows;
  return result;
}

export async function localIdentity(db: Client, env: NodeJS.ProcessEnv) {
  requireLocalGate(["--test"], env);
  const u = migrationTarget(env.TEST_DIRECT_DATABASE_URL, true);
  check(u.hostname === "127.0.0.1", "STOCK_LOOPBACK_REQUIRED");
  const marker = JSON.parse(
    await readFile(
      resolve(
        ".data/fixtures",
        `v42-${env.PUSULA_LOCAL_FIXTURE}`,
        "target.json",
      ),
      "utf8",
    ),
  );
  const row = (
    await db.query(
      `SELECT current_database() db,current_user actor,host(inet_server_addr()) host,inet_server_port() port,current_setting('data_directory') directory,current_setting('server_version_num')::int version`,
    )
  ).rows[0];
  check(row.actor === "fixture_admin", "STOCK_CLUSTER_ACTOR");
  check(row.host === "127.0.0.1", "STOCK_CLUSTER_HOST");
  check(
    row.port === Number(u.port) && row.port === marker.port,
    "STOCK_CLUSTER_PORT",
  );
  check(row.version === 180006, "STOCK_CLUSTER_VERSION");
  check(
    resolve(row.directory).toLowerCase() ===
      resolve(marker.dataDirectory).toLowerCase(),
    "STOCK_CLUSTER_DIRECTORY",
  );
  check(
    row.actor === "fixture_admin" &&
      row.host === "127.0.0.1" &&
      row.port === Number(u.port) &&
      row.db === marker.database &&
      marker.id === env.PUSULA_LOCAL_FIXTURE &&
      marker.port === row.port &&
      marker.host === row.host &&
      row.version === 180006 &&
      resolve(row.directory).toLowerCase() ===
        resolve(marker.dataDirectory).toLowerCase(),
    "STOCK_CLUSTER_IDENTITY_REJECTED",
  );
}

export async function stockFiles() {
  const files = await migrationFiles();
  const old = JSON.parse(
    await readFile("scripts/db/migration-baseline.json", "utf8"),
  );
  const pin = JSON.parse(
    await readFile("scripts/stock/migration-baseline.json", "utf8"),
  );
  check(
    files.length === 16 &&
      files[15].name === stockMigration &&
      files[15].checksum === stockChecksum &&
      pin.checksum === stockChecksum,
    "STOCK_CHECKSUM_REJECTED",
  );
  check(
    files.slice(0, 15).every((f) => old.migrations[f.name] === f.checksum),
    "STOCK_LEGACY_CHECKSUM_REJECTED",
  );
  const sql = await readFile(
    `prisma/migrations/${stockMigration}/migration.sql`,
    "utf8",
  );
  check(
    sql.startsWith(
      "BEGIN;\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='30s';\nSET LOCAL transaction_timeout='60s';",
    ) && /COMMIT;\s*$/.test(sql),
    "STOCK_TIMEOUT_CONTRACT_REJECTED",
  );
  return {
    files,
    pre: old.appliedSchema as Record<string, string>,
    post: pin.schema as Record<string, string>,
  };
}

export async function inspectStock(db: Client, pins?: AclPins) {
  const manifest = await stockFiles();
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query(
      "SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';SET LOCAL transaction_timeout='60s'",
    );
    const history = (
      await db.query(
        `SELECT migration_name,checksum,finished_at IS NOT NULL finished,rolled_back_at IS NOT NULL rolled_back FROM public._prisma_migrations ORDER BY migration_name`,
      )
    ).rows;
    check(
      history.every((r) => r.finished || r.rolled_back),
      "STOCK_MIGRATION_UNRESOLVED",
    );
    check(
      history.every((r) =>
        manifest.files.some(
          (f) => f.name === r.migration_name && f.checksum === r.checksum,
        ),
      ),
      "STOCK_HISTORY_CHECKSUM_REJECTED",
    );
    // Failed/resolved attempts are never silently cleared or treated as ready.
    check(
      history.every((r) => r.finished && !r.rolled_back),
      "STOCK_MIGRATION_HISTORY_REVIEW_REQUIRED",
    );
    const names = history.map((r) => r.migration_name);
    check(
      new Set(names).size === names.length &&
        [15, 16].includes(names.length) &&
        manifest.files
          .slice(0, names.length)
          .every((f) => names.includes(f.name)),
      "STOCK_HISTORY_REJECTED",
    );
    const applied = names.length === 16;
    const current = await catalog(db),
      expected = applied ? manifest.post : manifest.pre;
    for (const [k, v] of Object.entries(current))
      check(hash(v) === expected[k], "STOCK_SCHEMA_DRIFT_" + k);
    check(
      current.tables.length === (applied ? 47 : 40) &&
        current.tables.filter((t) => t.relrowsecurity && t.relforcerowsecurity)
          .length === (applied ? 33 : 26),
      "STOCK_COUNTS_REJECTED",
    );
    const acl = hash(await stockSecurity(db));
    if (pins) check(acl === pins[applied ? "post" : "pre"], "STOCK_ACL_DRIFT");
    const extra = (
      await db.query(
        `SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema')) OR EXISTS(SELECT 1 FROM pg_extension WHERE extname<>'plpgsql') OR EXISTS(SELECT 1 FROM pg_event_trigger) OR EXISTS(SELECT 1 FROM pg_largeobject_metadata) OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind NOT IN ('r','i','I','t')) OR EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='d') OR EXISTS(SELECT 1 FROM pg_operator WHERE oprnamespace='public'::regnamespace) AS unsafe`,
      )
    ).rows[0];
    check(!extra.unsafe, "STOCK_EXTRA_OBJECT_REJECTED");
    if (applied) {
      const role = (
        await db.query(
          `SELECT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication AS unsafe FROM pg_roles WHERE rolname='pusula_stock_executor'`,
        )
      ).rows[0];
      check(role && !role.unsafe, "STOCK_EXECUTOR_REJECTED");
      check(
        (
          await db.query(
            `SELECT count(*)::int n FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner='pusula_stock_executor'::regrole`,
          )
        ).rows[0].n === 0,
        "STOCK_EXECUTOR_OWNER_REJECTED",
      );
    } else
      check(
        !(
          await db.query(
            `SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pusula_stock_executor') yes`,
          )
        ).rows[0].yes,
        "STOCK_PARTIAL_ROLE_REJECTED",
      );
    return {
      state: applied
        ? ("ALREADY_APPLIED" as const)
        : ("PREFLIGHT_PASS" as const),
      applied: false,
      tables: current.tables.length,
      forced: applied ? 33 : 26,
      migrations: names.length,
      acl,
    };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "55P03")
      throw new MigrationSafetyError("STOCK_PREFLIGHT_LOCK_TIMEOUT");
    if (code === "57014")
      throw new MigrationSafetyError("STOCK_PREFLIGHT_STATEMENT_TIMEOUT");
    throw e;
  } finally {
    await db.query("ROLLBACK");
  }
}

export async function runStock(
  db: Client,
  env: NodeJS.ProcessEnv,
  options: {
    apply?: boolean;
    approved?: boolean;
    pins: AclPins;
    fixtureBeforeApply?: () => Promise<void>;
  },
) {
  requireAclPins(options.pins);
  requireLocalGate(
    [
      "--test",
      ...(options.apply ? ["--apply"] : []),
      ...(options.approved ? ["--approve-local-fixture"] : []),
    ],
    env,
  );
  await localIdentity(db, env);
  // Same advisory key as the legacy runner; a separate phase must not race it.
  check(
    (await db.query("SELECT pg_try_advisory_lock(2142042) locked")).rows[0]
      .locked,
    "STOCK_RUNNER_BUSY",
  );
  try {
    const before = await inspectStock(db, options.pins);
    if (before.state === "ALREADY_APPLIED" || !options.apply) return before;
    // Recheck immediately before child spawn; no hook bypasses catalog/ACL pins.
    await inspectStock(db, options.pins);
    // Only programmatic local-fixture tests can inject contention after preflight.
    if (options.fixtureBeforeApply) await options.fixtureBeforeApply();
    try {
      await runPrisma(db, { ...env, PUSULA_DB_TARGET: "test" });
    } catch {
      throw new MigrationSafetyError("STOCK_APPLY_STOPPED_REVIEW_REQUIRED");
    }
    const after = await inspectStock(db, options.pins);
    check(after.state === "ALREADY_APPLIED", "STOCK_POSTFLIGHT_FAILED");
    return { ...after, state: "APPLIED" as const, applied: true };
  } finally {
    await db.query("SELECT pg_advisory_unlock(2142042)");
  }
}

export async function main(args = process.argv.slice(2), env = process.env) {
  // This gate is evaluated BEFORE env loading, target resolution or any connection.
  requireLocalGate(args, env);
  const u = migrationTarget(env.TEST_DIRECT_DATABASE_URL, true);
  check(u.hostname === "127.0.0.1", "STOCK_LOOPBACK_REQUIRED");
  const pins: AclPins = JSON.parse(
    await readFile("scripts/stock/runner-baseline.json", "utf8"),
  );
  requireAclPins(pins);
  const db = await migrationClient(u, true);
  try {
    await db.connect();
    return await runStock(db, env, {
      apply: args.includes("--apply"),
      approved: args.includes("--approve-local-fixture"),
      pins,
    });
  } finally {
    await db.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => {
      console.error(
        JSON.stringify({
          status: "BLOCKED",
          code:
            e instanceof MigrationSafetyError ? e.code : "STOCK_RUNNER_FAILED",
        }),
      );
      process.exitCode = 1;
    });
