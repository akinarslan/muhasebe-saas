// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import {
  requireLocalGate,
  main,
  stockFiles,
  stockChecksum,
  requireAclPins,
  validateStockHistory,
} from "../scripts/stock/migrate";

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PUSULA_LOCAL_FIXTURE: "12345678-1234-1234-1234-123456789abc",
  PUSULA_DB_TARGET: "test",
};
describe("stock migration 016 separate safety gate", () => {
  it("rejects missing or malformed ACL pins instead of skipping ACL verification", () => {
    for (const pins of [null, undefined, {}, { pre: "0", post: "0" }])
      expect(() => requireAclPins(pins)).toThrow("STOCK_ACL_PIN_REQUIRED");
    expect(() =>
      requireAclPins({ pre: "a".repeat(64), post: "b".repeat(64) }),
    ).not.toThrow();
  });
  it("rejects cloud use before trying env files or a connection", async () => {
    await expect(
      main([], { NODE_ENV: "test", DIRECT_DATABASE_URL: "invalid" }),
    ).rejects.toThrow("STOCK_CLOUD_APPROVAL_REQUIRED");
  });
  it("does not interpret an apply flag as approval", () => {
    expect(() => requireLocalGate(["--test", "--apply"], env)).toThrow(
      "STOCK_LOCAL_APPROVAL_REQUIRED",
    );
    expect(() =>
      requireLocalGate(["--test", "--apply", "--approve-local-fixture"], env),
    ).not.toThrow();
  });
  it("rejects remote override and fixture-path override flags", () => {
    expect(() =>
      requireLocalGate(["--test", "--approve-development"], env),
    ).toThrow("STOCK_UNKNOWN_ARGUMENT");
    expect(() =>
      requireLocalGate(["--test"], {
        ...env,
        PUSULA_MIGRATION_FIXTURE_DIR: "elsewhere",
      }),
    ).toThrow("STOCK_FIXTURE_OVERRIDE_REJECTED");
  });
  it("pins all sixteen SQL files and the 3/30/60 migration timeout contract", async () => {
    const result = await stockFiles();
    expect(result.files).toHaveLength(16);
    expect(result.files[15].checksum).toBe(stockChecksum);
    expect(Object.keys(result.pre).sort()).toEqual(
      Object.keys(result.post).sort(),
    );
  });
  it("leaves the old cloud runner guard and backup scope closed", async () => {
    const old = await readFile("scripts/db/migrate.ts", "utf8");
    expect(old).toContain("STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW");
    const { expectedTables, expectedForcedTables } =
      await import("../scripts/backup/postgres");
    expect(expectedTables).toHaveLength(35);
    expect(expectedForcedTables).toHaveLength(21);
    expect(expectedTables).not.toContain("StockMovement");
  });
});

describe("reviewed resolved stock history", () => {
  const files = Array.from({ length: 16 }, (_, i) => ({
    name: i === 7 ? "202610160008_company_metadata" : `migration-${i}`,
    checksum: String(i).padStart(64, "0"),
  }));
  const success = files
    .slice(0, 15)
    .map((f) => ({
      ...f,
      migration_name: f.name,
      finished: true,
      rolled_back: false,
    }));
  const rollback = { ...success[7], finished: false, rolled_back: true };
  it("counts successful migrations and retains the reviewed 008 rollback", () => {
    const rows = [...success, rollback];
    const before = JSON.stringify(rows);
    expect(validateStockHistory(rows, files)).toHaveLength(15);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it.each([
    [{ ...rollback, rolled_back: false }, "STOCK_MIGRATION_UNRESOLVED"],
    [
      { ...rollback, checksum: "f".repeat(64) },
      "STOCK_HISTORY_CHECKSUM_REJECTED",
    ],
    [success[7], "STOCK_HISTORY_REJECTED"],
    [
      {
        ...rollback,
        migration_name: files[8].name,
        checksum: files[8].checksum,
      },
      "STOCK_MIGRATION_HISTORY_REVIEW_REQUIRED",
    ],
    [
      { ...rollback, finished: true },
      "STOCK_MIGRATION_HISTORY_REVIEW_REQUIRED",
    ],
  ])("rejects unsafe history %#", (extra, code) => {
    expect(() => validateStockHistory([...success, extra], files)).toThrow(
      code,
    );
  });
  it("rejects duplicate rollbacks and missing success", () => {
    expect(() =>
      validateStockHistory([...success, rollback, rollback], files),
    ).toThrow("STOCK_MIGRATION_HISTORY_REVIEW_REQUIRED");
    expect(() =>
      validateStockHistory(
        [
          ...success.filter(
            (r) => r.migration_name !== rollback.migration_name,
          ),
          rollback,
        ],
        files,
      ),
    ).toThrow("STOCK_MIGRATION_HISTORY_REVIEW_REQUIRED");
    expect(() => validateStockHistory(success.slice(0, 14), files)).toThrow(
      "STOCK_HISTORY_REJECTED",
    );
  });
});
