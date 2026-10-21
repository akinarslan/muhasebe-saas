// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import {
  requireLocalGate,
  main,
  stockFiles,
  stockChecksum,
  requireAclPins,
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
