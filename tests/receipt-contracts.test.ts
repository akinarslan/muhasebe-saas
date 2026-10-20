import { describe, it, expect } from "vitest";
import {
  receiptCreate,
  receiptLine,
  stockArea,
} from "@/lib/cloud/receipt-contracts";
const line = {
  orderLineId: "d96904f7-107a-47b5-b049-b92ea0a6cb24",
  lineNo: 1,
  receivedQty: "2",
  rejectedQty: "0",
  rejectionReason: "",
  singlePackage: true,
};
describe("receipt quantities and physical stock (pure unit tests)", () => {
  it("normalizes decimal strings without floating point", () => {
    expect(
      receiptLine.parse({ ...line, receivedQty: "02.000000000" }).receivedQty,
    ).toBe("2");
  });
  it.each(["0", "-1", "NaN", "Infinity", "1.0000000001"])(
    "rejects invalid incoming %s",
    (v) =>
      expect(receiptLine.safeParse({ ...line, receivedQty: v }).success).toBe(
        false,
      ),
  );
  it("rejects over-rejection and demands reason", () => {
    expect(
      receiptLine.safeParse({
        ...line,
        rejectedQty: "3",
        rejectionReason: "damaged",
      }).success,
    ).toBe(false);
    expect(receiptLine.safeParse({ ...line, rejectedQty: "1" }).success).toBe(
      false,
    );
  });
  it("fully rejected receipt is a physical document with no stock", () =>
    expect(
      receiptLine.safeParse({
        ...line,
        rejectedQty: "2",
        rejectionReason: "damaged",
      }).success,
    ).toBe(true));
  it("requires explicit single physical package confirmation", () =>
    expect(
      receiptLine.safeParse({ ...line, singlePackage: false }).success,
    ).toBe(false));
  it("preserves roll length and derives area", () =>
    expect(stockArea("2", "152", null, "ROLL")).toBe("3.04"));
  it("derives sheets by dimensions and count", () =>
    expect(stockArea("3", "100", "200", "SHEET")).toBe("6"));
  it("does not invent area for pieces", () =>
    expect(stockArea("3", null, null, "PIECE")).toBe(null));
  it("rejects client authority over stock/cost/actor", () =>
    expect(
      receiptCreate.safeParse({
        legalEntityId: line.orderLineId,
        orderId: line.orderLineId,
        locationId: line.orderLineId,
        idempotencyKey: line.orderLineId,
        receivedAt: "2026-10-20",
        lines: [line],
        quantityBase: "999",
        createdById: "attacker",
      }).success,
    ).toBe(false));
});
