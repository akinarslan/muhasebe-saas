// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve } from "node:path";
import type { Client } from "pg";
import { restoreFixture } from "../scripts/backup/restore-fixture";
const fake = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../scripts/backup/postgres", () => ({
  expectedTables: ["Tenant"],
  runTool: fake.run,
}));
const uuid = "11111111-1111-4111-8111-111111111111";
const directory = resolve(".data/fixtures/e23-" + uuid),
  dataDirectory = resolve(directory, "data");
beforeEach(() => fake.run.mockReset());
function setup() {
  const source = {
    query: vi.fn(async (sql: string) => {
      if (sql === "SHOW data_directory")
        return { rows: [{ data_directory: dataDirectory }] };
      if (sql.startsWith("SELECT 1 FROM pg_database"))
        return { rowCount: 0, rows: [] };
      if (sql.startsWith("SELECT oid FROM")) return { rows: [{ oid: 42 }] };
      return { rows: [] };
    }),
  };
  const target = {
    connect: vi.fn(async () => {}),
    end: vi.fn(async () => {}),
    query: vi.fn(async (sql: string) => {
      if (sql === "SHOW data_directory")
        return { rows: [{ data_directory: dataDirectory }] };
      if (sql.startsWith("SELECT oid FROM")) return { rows: [{ oid: 42 }] };
      if (sql.includes("AS relations"))
        return {
          rows: [
            {
              relations: 1,
              functions: 0,
              extra_schemas: 0,
              types: 0,
              large_objects: 0,
            },
          ],
        };
      return { rows: [] };
    }),
  };
  const input = {
    source: source as unknown as Client,
    connect: vi.fn(() => target as unknown as Client),
    dataDirectory,
    directory,
    decrypted: resolve(directory, "decrypted.dump"),
    pgRestore: "pg_restore",
    environment: {
      NODE_ENV: "test" as const,
      PGHOST: "127.0.0.1",
      PGDATABASE: "pusula_backup_fixture",
    },
    readerPassword: "imaginary",
    backupPassword: "imaginary",
    pass: vi.fn(),
  };
  return { source, target, input };
}
describe("local restore target must never be an existing application database", () => {
  it("rejects any remote source before SQL or pg_restore", async () => {
    const { input, source } = setup();
    input.environment.PGHOST = "example.invalid";
    await expect(restoreFixture(input)).rejects.toThrow(
      "RESTORE_SOURCE_REJECTED",
    );
    expect(source.query).not.toHaveBeenCalled();
    expect(fake.run).not.toHaveBeenCalled();
  });
  it("rejects outside-workspace directories before SQL", async () => {
    const { input, source } = setup();
    input.directory = resolve("../e23-" + uuid);
    input.dataDirectory = resolve(input.directory, "data");
    await expect(restoreFixture(input)).rejects.toThrow(
      "RESTORE_CLUSTER_REJECTED",
    );
    expect(source.query).not.toHaveBeenCalled();
  });
  it("rejects an existing target before CREATE DATABASE", async () => {
    const { input, source } = setup();
    source.query.mockImplementation(async (sql: string) =>
      sql === "SHOW data_directory"
        ? { rows: [{ data_directory: dataDirectory }] }
        : { rows: [], rowCount: 1 },
    );
    await expect(restoreFixture(input)).rejects.toThrow(
      "RESTORE_TARGET_ALREADY_EXISTS",
    );
    expect(
      source.query.mock.calls.some((c) => c[0].startsWith("CREATE DATABASE")),
    ).toBe(false);
    expect(fake.run).not.toHaveBeenCalled();
  });
  it("rejects a nonempty new target without invoking pg_restore and closes it", async () => {
    const { input, target } = setup();
    await expect(restoreFixture(input)).rejects.toThrow(
      "RESTORE_TARGET_NOT_EMPTY",
    );
    expect(fake.run).not.toHaveBeenCalled();
    expect(target.end).toHaveBeenCalled();
  });
  it("rejects a cluster identity mismatch before reading application tables", async () => {
    const { input, source } = setup();
    source.query.mockResolvedValue({
      rows: [{ data_directory: resolve("elsewhere") }],
    } as never);
    await expect(restoreFixture(input)).rejects.toThrow(
      "RESTORE_CLUSTER_REJECTED",
    );
    expect(fake.run).not.toHaveBeenCalled();
  });
});
