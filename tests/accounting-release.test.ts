// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { financeMigrationCandidate } from "../scripts/accounting/prepare-migration";
import { accountingTables } from "../scripts/backup/accounting-coverage";
import { expectedTables, validateToc } from "../scripts/backup/postgres";
function toc(tables: readonly string[]) {
  return (
    tables
      .map((name, i) => `${i + 1}; 0 0 TABLE DATA public ${name} fixture_admin`)
      .join("\n") +
    "\n100; 0 0 POLICY public x p owner\n101; 0 0 TRIGGER public CloudSaleLine d_seal_sale_line owner\n102; 0 0 TRIGGER public CloudPaymentPlan d_seal_payment_plan owner\n103; 0 0 FK CONSTRAINT public x f owner\n104; 0 0 INDEX public i owner\n"
  );
}
describe("accounting release artifacts", () => {
  it("checked migration is reproducible from untouched K1-K4 sources", async () => {
    const generated = await financeMigrationCandidate();
    expect(generated.sql).toBe(
      await readFile(
        "scripts/accounting/migration-candidate/017-finance.sql",
        "utf8",
      ),
    );
    expect(generated.manifest).toEqual(
      JSON.parse(
        await readFile(
          "scripts/accounting/migration-candidate/manifest.json",
          "utf8",
        ),
      ),
    );
  });
  it("56-table accounting archive requires journal posting allocation and expense while remote default remains35", () => {
    expect(accountingTables.length).toBe(56);
    expect(expectedTables.length).toBe(35);
    expect(() =>
      validateToc(toc(accountingTables), accountingTables),
    ).not.toThrow();
    expect(() => validateToc(toc(accountingTables))).toThrow(
      "DUMP_TABLE_DATA_INCOMPLETE",
    );
    for (const missing of [
      "FinanceJournal",
      "FinancePosting",
      "FinanceAllocation",
      "FinanceExpense",
    ])
      expect(() =>
        validateToc(
          toc(accountingTables.filter((t) => t !== missing)),
          accountingTables,
        ),
      ).toThrow("DUMP_TABLE_DATA_INCOMPLETE");
  });
});
