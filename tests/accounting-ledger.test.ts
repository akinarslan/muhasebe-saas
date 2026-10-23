// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  tryAmount,
  accountingDate,
  openingCreate,
} from "../src/lib/cloud/accounting-contracts";

describe("K1 exact financial input boundary", () => {
  it("normalizes decimal strings without binary arithmetic", () => {
    expect(tryAmount.parse("0.30")).toBe("0.30");
    expect(tryAmount.parse("-10.01")).toBe("-10.01");
    expect(tryAmount.parse("99999999999999.99")).toBe("99999999999999.99");
    expect(tryAmount.parse("0")).toBe("0.00");
  });
  it.each([
    0.1,
    "1e3",
    "1.001",
    "NaN",
    "Infinity",
    "100000000000000",
    "01",
    "1,50",
  ])("rejects unsafe amount %s", (value) => {
    expect(tryAmount.safeParse(value).success).toBe(false);
  });
  it("rejects calendar rollover and invalid dates", () => {
    expect(accountingDate.safeParse("2026-02-30").success).toBe(false);
  });
  it("requires TRY and due date after booking", () => {
    const input = {
      legalEntityId: "a2222222-2222-4222-8222-222222222222",
      accountId: "a2222222-2222-4222-8222-222222222222",
      idempotencyKey: "a2222222-2222-4222-8222-222222222222",
      amount: "10",
      currency: "TRY",
      bookedOn: "2026-10-22",
      dueOn: "2026-10-21",
      reason: "Opening",
    };
    expect(openingCreate.safeParse(input).success).toBe(false);
    expect(
      openingCreate.safeParse({ ...input, dueOn: null, currency: "USD" })
        .success,
    ).toBe(false);
  });
});
