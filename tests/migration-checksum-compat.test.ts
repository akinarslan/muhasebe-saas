// @vitest-environment node
import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  migrationChecksumMatches,
  reviewedRollback008,
} from "../scripts/db/migration-checksum";
import {
  migrationFiles,
  validateHistory,
} from "../scripts/db/migration-safety";
import { validateStockHistory } from "../scripts/stock/migrate";

const names = [
  "202610160004_auth_mfa",
  "202610160005_authorization",
  "202610160007_resource_policy",
  "202610160008_company_metadata",
  "202610170012_cloud_catalog_controls",
];
const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");
it.each(names)(
  "accepts only verified LF/final-CRLF identities: %s",
  async (name) => {
    const baseline = JSON.parse(
      await readFile("scripts/db/migration-baseline.json", "utf8"),
    );
    const bytes = await readFile(`prisma/migrations/${name}/migration.sql`);
    // This reconstructs test input only. Production code never normalizes bytes.
    const lf = bytes.subarray(-2).equals(Buffer.from("\r\n"))
      ? Buffer.concat([bytes.subarray(0, -2), Buffer.from("\n")])
      : bytes;
    const historical = Buffer.concat([lf.subarray(0, -1), Buffer.from("\r\n")]);
    const expected = baseline.migrations[name];
    expect(migrationChecksumMatches(name, expected, digest(lf))).toBe(true);
    expect(migrationChecksumMatches(name, expected, digest(historical))).toBe(
      true,
    );
    expect(migrationChecksumMatches(name, digest(lf), expected)).toBe(true);
    for (const bad of [
      Buffer.from(lf.toString("utf8").replace(/\b(?:CREATE|ALTER)\b/, "DROP")),
      Buffer.concat([lf, Buffer.from(" ")]),
      Buffer.from(lf.toString("utf8").replaceAll("\n", "\r\n")),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), lf]),
    ])
      expect(migrationChecksumMatches(name, expected, digest(bad))).toBe(false);
    const changed = Buffer.from(lf);
    changed[0] ^= 1;
    expect(migrationChecksumMatches(name, expected, digest(changed))).toBe(
      false,
    );
    expect(migrationChecksumMatches("wrong-name", expected, digest(lf))).toBe(
      false,
    );
    expect(migrationChecksumMatches(name, expected, "0".repeat(64))).toBe(
      false,
    );
  },
);

it("preserves real resolved 008 checksum while rejecting failed bytes as successful SQL", async () => {
  const files = await migrationFiles();
  const baseline = JSON.parse(
    await readFile("scripts/db/migration-baseline.json", "utf8"),
  );
  const successful = files
    .slice(0, 15)
    .map((f) => ({
      migration_name: f.name,
      checksum: baseline.migrations[f.name],
      finished: true,
      rolled_back: false,
    }));
  const rollback = {
    migration_name: "202610160008_company_metadata",
    checksum: reviewedRollback008,
    finished: false,
    rolled_back: true,
  };
  const rows = [...successful, rollback];
  const saved = JSON.stringify(rows);
  expect(validateStockHistory(rows, files)).toHaveLength(15);
  expect(validateHistory(rows, files.slice(0, 15))).toBe("ALREADY_APPLIED");
  expect(JSON.stringify(rows)).toBe(saved);
  expect(() =>
    validateStockHistory(
      [...successful, { ...rollback, rolled_back: false }],
      files,
    ),
  ).toThrow("STOCK_MIGRATION_UNRESOLVED");
  expect(() =>
    validateStockHistory([...successful, successful[7]], files),
  ).toThrow("STOCK_HISTORY_REJECTED");
  expect(() => validateStockHistory(successful.slice(0, 14), files)).toThrow(
    "STOCK_HISTORY_REJECTED",
  );
  expect(() =>
    validateStockHistory(
      [...successful, { ...rollback, checksum: "0".repeat(64) }],
      files,
    ),
  ).toThrow("STOCK_HISTORY_CHECKSUM_REJECTED");
  const badSuccess = successful.map((r, i) =>
    i === 7 ? { ...r, checksum: reviewedRollback008 } : r,
  );
  expect(() => validateStockHistory(badSuccess, files)).toThrow(
    "STOCK_HISTORY_CHECKSUM_REJECTED",
  );
  expect(
    migrationChecksumMatches(
      rollback.migration_name,
      successful[7].checksum,
      reviewedRollback008,
    ),
  ).toBe(false);
});
