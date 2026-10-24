// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { assertProviderCredential } from "../scripts/stock/provider-credential";
import {
  expectedPreGrantors,
  reviewPreGrantors,
} from "../scripts/stock/grantor-review";
import { validateToc } from "../scripts/backup/postgres";
import { accountingTables } from "../scripts/backup/accounting-coverage";
import type { Rows } from "../scripts/stock/managed-contract";

const security = JSON.parse(
  readFileSync("scripts/stock/managed-contract.json", "utf8"),
).pre.security as Rows;
describe("M016 P0 offline gates", () => {
  it("rejects expired OAuth metadata before a request, without exposing token", () => {
    expect(() =>
      assertProviderCredential(
        { access_token: "synthetic", type: "oauth", expires_at: 999 },
        1000,
      ),
    ).toThrow("NEON_CREDENTIAL_EXPIRED_OR_EXPIRING");
    expect(() =>
      assertProviderCredential(
        { access_token: "synthetic", type: "oauth" },
        1000,
      ),
    ).toThrow("NEON_CREDENTIAL_EXPIRY_UNVERIFIED");
    expect(() =>
      assertProviderCredential(
        { access_token: "synthetic", type: "oauth", expires_at: NaN },
        1000,
      ),
    ).toThrow("NEON_CREDENTIAL_EXPIRY_UNVERIFIED");
    expect(() =>
      assertProviderCredential(
        { access_token: "synthetic", type: "oauth", expires_at: 40000 },
        1000,
      ),
    ).not.toThrow();
    expect(() =>
      assertProviderCredential(
        { access_token: "synthetic", expires_at: 999 },
        1000,
      ),
    ).toThrow("NEON_CREDENTIAL_EXPIRED_OR_EXPIRING");
    expect(() =>
      assertProviderCredential(
        { access_token: "synthetic", type: "unknown" },
        1000,
      ),
    ).toThrow("NEON_CREDENTIAL_TYPE_UNSUPPORTED");
  });
  it("derives expected rights without observing the new snapshot; never approves cloud", () => {
    const expected = expectedPreGrantors(security);
    expect(expected).toHaveLength(494);
    expect(reviewPreGrantors(security, expected)).toMatchObject({
      matched: 494,
      missing: [],
      unexpected: [],
      accepted: false,
      applyEnabled: false,
    });
  });
  it.each(["grantor", "grantee", "is_grantable"])(
    "rejects %s drift independently",
    (field) => {
      const rows = expectedPreGrantors(security);
      rows[0][field] = field === "is_grantable" ? true : "unexpected";
      const review = reviewPreGrantors(security, rows);
      expect(review.status).toBe("DRIFT");
      expect(review.missing).toHaveLength(1);
      expect(review.unexpected).toHaveLength(1);
    },
  );
  it("rejects missing, duplicate and absent evidence", () => {
    const rows = expectedPreGrantors(security);
    expect(reviewPreGrantors(security, rows.slice(1)).missing).toHaveLength(1);
    expect(
      reviewPreGrantors(security, [...rows, rows[0]]).unexpected,
    ).toHaveLength(1);
    expect(() => reviewPreGrantors(security, null)).toThrow(
      "GRANTOR_EVIDENCE_MISSING",
    );
    expect(() => expectedPreGrantors({ ...security, columns: [{}] })).toThrow(
      "COLUMN_GRANTOR_REVIEW_REQUIRED",
    );
  });
  const pairs = [
    ["FinanceAccount", "finance_immutable"],
    ["FinanceJournal", "finance_immutable"],
    ["FinancePosting", "finance_immutable"],
    ["FinanceJournal", "finance_journal_balance"],
    ["FinancePosting", "finance_posting_balance"],
    ["CloudSale", "finance_sale_atomic"],
    ["FinanceOperation", "k3_immutable"],
    ["FinanceAllocation", "k3_immutable"],
    ["FinanceFundMovement", "k3_immutable"],
    ["FinanceIntent", "k3_intent_no_delete"],
    ["FinanceOperation", "k3_atomic"],
    ["FinanceExpense", "k4_immutable"],
    ["FinanceExpense", "k4_atomic"],
    ["CloudSaleLine", "d_seal_sale_line"],
    ["CloudPaymentPlan", "d_seal_payment_plan"],
  ];
  const toc = [
    ...accountingTables.map((t) => `1; 0 1 TABLE DATA public ${t} owner`),
    ...pairs.map(([t, n]) => `2; 0 1 TRIGGER public ${t} ${n} owner`),
    "3; 0 1 POLICY public FinanceJournal finance_scope owner",
    "4; 0 1 FK CONSTRAINT public FinanceJournal fk owner",
    "5; 0 1 INDEX public finance_allocation_source owner",
  ].join("\n");
  it("accepts synthetic full finance TOC without dump/upload/restore", () => {
    expect(() => validateToc(toc, accountingTables)).not.toThrow();
  });
  it.each(pairs.slice(0, 13))(
    "rejects missing finance trigger %s/%s",
    (t, n) => {
      expect(() =>
        validateToc(
          toc.replace(`2; 0 1 TRIGGER public ${t} ${n} owner`, ""),
          accountingTables,
        ),
      ).toThrow("DUMP_FINANCE_TRIGGER_MISSING");
    },
  );
  it("rejects a missing finance table even when other schema entries remain", () => {
    expect(() =>
      validateToc(
        toc.replace("1; 0 1 TABLE DATA public FinanceExpense owner", ""),
        accountingTables,
      ),
    ).toThrow("DUMP_TABLE_DATA_INCOMPLETE");
  });
});
