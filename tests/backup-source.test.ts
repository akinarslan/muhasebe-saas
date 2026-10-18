// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  expectedForcedTables,
  expectedTables,
  inspectSource,
  sourceTarget,
  pgEnvironment,
} from "../scripts/backup/postgres";
import { developmentTarget } from "../src/server/db/target";
import functionFixtures from "./fixtures/backup-functions.json";
import {
  securitySql,
  functionSql,
  validateFunctions,
} from "../scripts/backup/source-security";

const mock = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
}));
vi.mock("pg", () => ({
  Client: class {
    query = mock.query;
    connect = mock.connect;
    end = mock.end;
  },
}));
let tables: Record<string, unknown>[],
  role: Record<string, boolean>,
  incomplete: boolean,
  wrongChecksum: boolean;
let elevated: Record<string, boolean>;
let security: Record<string, boolean>;
let functions: typeof functionFixtures;
beforeEach(async () => {
  mock.query.mockReset();
  mock.connect.mockReset();
  mock.end.mockReset();
  mock.end.mockResolvedValue(undefined);
  role = {
    rolbypassrls: true,
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolreplication: false,
    managed_admin: false,
  };
  tables = expectedTables.map((name) => ({
    name,
    schema: "public",
    rls: expectedForcedTables.includes(name),
    force: expectedForcedTables.includes(name),
    readable: true,
    writable: false,
  }));
  incomplete = false;
  wrongChecksum = false;
  security = Object.fromEntries(
    [
      "database_temp",
      "role_membership",
      "object_owner",
      "extra_schema",
      "extra_relation",
      "large_objects",
      "extra_extension",
      "event_trigger",
      "extra_type",
      "column_write",
      "select_grant_option",
    ].map((k) => [k, false]),
  );
  functions = structuredClone(functionFixtures);
  elevated = {
    database_create: false,
    schema_create: false,
    sequence_write: false,
  };
  const dirs = await readdir("prisma/migrations", { withFileTypes: true });
  const migrations = await Promise.all(
    dirs
      .filter((d) => d.isDirectory())
      .map(async (d) => ({
        migration_name: d.name,
        checksum: createHash("sha256")
          .update(
            await readFile(join("prisma/migrations", d.name, "migration.sql")),
          )
          .digest("hex"),
        finished_at: true,
        rolled_back_at: null,
      })),
  );
  mock.query.mockImplementation(async (sql: string) => {
    if (sql === securitySql) return { rows: [security] };
    if (sql === functionSql) return { rows: functions };
    if (sql.includes("FROM pg_roles r")) return { rows: [role] };
    if (sql.includes(" AS database_create"))
      return {
        rows: [
          {
            ...elevated,
          },
        ],
      };
    if (sql === "SHOW server_version_num")
      return { rows: [{ server_version_num: "180006" }] };
    if (sql.includes("FROM pg_class")) return { rows: tables };
    if (sql.includes("FROM public._prisma_migrations"))
      return {
        rows: migrations.map((m) => ({
          ...m,
          finished_at: incomplete ? null : true,
          checksum: wrongChecksum ? "bad" : m.checksum,
        })),
      };
    if (sql.includes("count(*)")) return { rows: [{ n: "2" }] };
    if (sql.includes("pg_export_snapshot"))
      return { rows: [{ snapshot: "00000001-00000002-1" }] };
    return { rows: [] };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const source = () =>
  sourceTarget(
    `postgresql://pusula_backup:fixture@${developmentTarget.host}/pusula_development?sslmode=verify-full`,
  );

describe("snapshot coverage with mocked PostgreSQL connection — not actual dump evidence", () => {
  it("passes the private CA path to libpq without weakening TLS or exporting application secrets", () => {
    vi.stubEnv("BACKUP_PG_SSLROOTCERT", "C:/private/fixture-ca.pem");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "imaginary-r2-secret");
    const env = pgEnvironment(source());
    expect(env.PGSSLROOTCERT).toBe("C:/private/fixture-ca.pem");
    expect(env.PGSSLMODE).toBe("verify-full");
    expect(env.R2_SECRET_ACCESS_KEY).toBeUndefined();
  });
  it("pins only function bodies present in the checked-in migration SQL", async () => {
    const dirs = await readdir("prisma/migrations", { withFileTypes: true });
    const sql = (
      await Promise.all(
        dirs
          .filter((d) => d.isDirectory())
          .map((d) =>
            readFile(
              join("prisma/migrations", d.name, "migration.sql"),
              "utf8",
            ),
          ),
      )
    )
      .join("\n")
      .replaceAll("\r\n", "\n");
    for (const f of functionFixtures) {
      const body = f.definition.match(
        /AS \$function\$([\s\S]*)\$function\$/,
      )?.[1];
      expect(body).toBeTruthy();
      expect(sql).toContain(body!.trim());
    }
  });
  it.each([
    "database_temp",
    "role_membership",
    "object_owner",
    "extra_schema",
    "extra_relation",
    "large_objects",
    "extra_extension",
    "event_trigger",
    "extra_type",
    "column_write",
    "select_grant_option",
  ])("rejects %s before data reads", async (key) => {
    security[key] = true;
    await expect(inspectSource(source())).rejects.toThrow();
    expect(mock.query.mock.calls.some((a) => a[0].includes("count(*)"))).toBe(
      false,
    );
    expect(mock.end).toHaveBeenCalled();
  });
  it.each([
    "database_temp",
    "role_membership",
    "object_owner",
    "extra_schema",
    "extra_relation",
    "large_objects",
    "extra_extension",
    "event_trigger",
    "extra_type",
    "column_write",
    "select_grant_option",
  ])("fails closed on missing %s metadata", async (key) => {
    delete security[key];
    await expect(inspectSource(source())).rejects.toThrow();
  });
  it("accepts the reviewed migration function definitions", () =>
    expect(() => validateFunctions(functionFixtures)).not.toThrow());
  it.each(["added", "removed", "definer", "modified", "signature"])(
    "rejects %s function changes before data reads",
    async (kind) => {
      if (kind === "added")
        functions.push({ ...functions[0], identity: "evil()" });
      if (kind === "removed") functions.pop();
      if (kind === "definer") functions[0].security_definer = true;
      if (kind === "modified") functions[0].definition += "-- modified";
      if (kind === "signature") functions[0].identity += " ";
      await expect(inspectSource(source())).rejects.toThrow();
      expect(mock.query.mock.calls.some((a) => a[0].includes("count(*)"))).toBe(
        false,
      );
    },
  );
  it.each(["database_create", "schema_create", "sequence_write"])(
    "rejects unexpected %s capability",
    async (k) => {
      elevated[k] = true;
      await expect(inspectSource(source())).rejects.toThrow(
        "SOURCE_DDL_OR_SEQUENCE_WRITE_REJECTED",
      );
      expect(mock.end).toHaveBeenCalled();
    },
  );
  it("exports one read-only repeatable snapshot after full no-RLS-filter counts", async () => {
    const result = await inspectSource(source());
    expect(result.tables).toBe(35);
    expect(result.version).toBe("18.6");
    expect(result.snapshot).toBe("00000001-00000002-1");
    const sql = mock.query.mock.calls.map((a) => a[0]);
    expect(sql[0]).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(sql[1]).toBe("SET LOCAL row_security = off");
    expect(sql.filter((s) => s.includes("count(*)")).length).toBe(35);
    expect(sql.at(-1)).toContain("pg_export_snapshot");
    await result.db.end();
  });
  it.each(["rolcreatedb", "rolcreaterole", "rolsuper", "managed_admin"])(
    "closes connection when role has %s",
    async (k) => {
      role[k] = true;
      await expect(inspectSource(source())).rejects.toThrow(
        "BACKUP_ROLE_REJECTED",
      );
      expect(mock.end).toHaveBeenCalled();
    },
  );
  it("rejects non-bypass RLS before count or dump", async () => {
    role.rolbypassrls = false;
    await expect(inspectSource(source())).rejects.toThrow(
      "BACKUP_ROLE_REJECTED",
    );
    expect(mock.query.mock.calls.some((a) => a[0].includes("count(*)"))).toBe(
      false,
    );
  });
  it.each(["readable", "writable"])(
    "rejects incorrect table %s privilege",
    async (k) => {
      tables[0][k] = k === "writable";
      await expect(inspectSource(source())).rejects.toThrow(
        "SOURCE_PRIVILEGES_REJECTED",
      );
    },
  );
  it("rejects omitted auth table even with unchanged total count", async () => {
    tables.find((t) => t.name === "AuthTwoFactor")!.name = "PretendTable";
    await expect(inspectSource(source())).rejects.toThrow(
      "SCHEMA_COVERAGE_REJECTED",
    );
  });
  it("rejects another schema rather than silently excluding it", async () => {
    tables[0].schema = "other";
    await expect(inspectSource(source())).rejects.toThrow(
      "SOURCE_PRIVILEGES_REJECTED",
    );
  });
  it("rejects disabled FORCE RLS", async () => {
    tables.find((t) => t.force)!.force = false;
    await expect(inspectSource(source())).rejects.toThrow(
      "RLS_COVERAGE_REJECTED",
    );
  });
  it("rejects unfinished migrations", async () => {
    incomplete = true;
    await expect(inspectSource(source())).rejects.toThrow(
      "MIGRATIONS_INCOMPLETE",
    );
  });
  it("rejects drift between checked-out SQL and DB migration checksums", async () => {
    wrongChecksum = true;
    await expect(inspectSource(source())).rejects.toThrow(
      "MIGRATION_CHECKSUM_MISMATCH",
    );
  });
  it("closes safely after connection interruption", async () => {
    mock.connect.mockRejectedValue(new Error("synthetic-network-interruption"));
    await expect(inspectSource(source())).rejects.toThrow();
    expect(mock.end).toHaveBeenCalled();
  });
});
