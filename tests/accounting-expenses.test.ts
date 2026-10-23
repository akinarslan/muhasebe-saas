import { describe, expect, it } from "vitest";
import {
  expenseCreate,
  financeRange,
} from "../src/lib/cloud/expense-contracts";
const id = "123e4567-e89b-42d3-a456-426614174000";
const base = {
  legalEntityId: id,
  intentId: id,
  idempotencyKey: id,
  currency: "TRY",
  category: "RENT",
  description: "Kira gideri",
  documentRef: "KIRA-2026-10",
  bookedOn: "2026-10-23",
  net: "2500",
  vat: "500",
  payment: "CASH",
  fundAccountId: id,
};
describe("real operating expense boundary", () => {
  it("preserves net and VAT decimal strings", () => {
    expect(expenseCreate.parse(base)).toMatchObject({
      net: "2500.00",
      vat: "500.00",
    });
  });
  it.each([
    { net: 3000 },
    { net: "1e3" },
    { net: "2.500,00" },
    { net: "0" },
    { vat: "-1" },
    { vat: "0.001" },
    { net: "99999999999999.99", vat: "1" },
    { category: "STOCK_PURCHASE" },
    { category: "CloudExpenseType" },
    { bookedOn: "2026-02-30" },
    { dueOn: "2026-10-01" },
    { cardNumber: "123" },
  ])("rejects invalid money classification and dates %j", (change) =>
    expect(expenseCreate.safeParse({ ...base, ...change }).success).toBe(false),
  );
  it("requires supplier and due date for credit, no fund", () => {
    expect(
      expenseCreate.safeParse({ ...base, payment: "CREDIT" }).success,
    ).toBe(false);
    expect(
      expenseCreate.safeParse({
        ...base,
        payment: "CREDIT",
        supplierId: id,
        dueOn: "2026-10-24",
        fundAccountId: null,
      }).success,
    ).toBe(true);
  });
  it("requires a fund for a cash expense", () =>
    expect(
      expenseCreate.safeParse({ ...base, fundAccountId: null }).success,
    ).toBe(false));
  it("rejects reversed or invalid report ranges", () => {
    expect(
      financeRange.safeParse({ from: "2026-10-24", through: "2026-10-23" })
        .success,
    ).toBe(false);
    expect(
      financeRange.safeParse({ from: "2026-02-30", through: "2026-10-23" })
        .success,
    ).toBe(false);
  });
});
