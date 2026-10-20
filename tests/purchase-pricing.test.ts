// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  purchaseFx,
  purchaseLineMath,
  purchaseOrderTotal,
  purchaseUnitFactor,
} from "../src/lib/cloud/purchase-pricing";
import {
  parseStatus,
  purchaseAction,
  purchaseOrderCreate,
  purchaseOrderEdit,
  purchaseLineInput,
} from "../src/lib/cloud/purchase-contracts";
import { supplierBusinessDate } from "../src/lib/cloud/supplier-date";

describe("purchase pricing math", () => {
  it("F02: price per metre is multiplied by metres, independently of stock area", () => {
    expect(purchaseLineMath("2", "1.52", "15.20")).toEqual({
      orderedBaseQty: "3.04",
      lineTotalUsd: "30.400000000",
    });
    expect(purchaseLineMath("3", "6", "20")).toEqual({
      orderedBaseQty: "18",
      lineTotalUsd: "60.000000000",
    });
    expect(purchaseLineMath("3.04", "1", "10").lineTotalUsd).toBe(
      "30.400000000",
    );
  });
  it("F09: rejects a product that cannot be represented exactly at quantity scale 9", () => {
    expect(() => purchaseLineMath("1.000000001", "1.52", "15.2")).toThrow(
      "UNIT_CONVERSION_REJECTED",
    );
  });
  it("freezes 15.2 metre at factor 1.52 into an exact 23.104 m² quantity", () => {
    const math = purchaseLineMath("15.2", "1.52", "10");
    expect(math.orderedBaseQty).toBe("23.104");
    expect(math.lineTotalUsd).toBe("152.000000000");
  });
  it("adds orderedDecimal totals without float error", () => {
    const totals = purchaseOrderTotal([
      { lineTotalUsd: "0.1" },
      { lineTotalUsd: "0.2" },
      { lineTotalUsd: "999999999999.000000000" },
    ]);
    expect(totals.pending).toBe(0);
    expect(totals.totalUsd).toBe("999999999999.300000000");
  });
  it("keeps pending USD sums open while any EUR/GBP line waits", () => {
    const totals = purchaseOrderTotal([
      { lineTotalUsd: "2" },
      { lineTotalUsd: null },
    ]);
    expect(totals.totalUsd).toBeNull();
    expect(totals.pending).toBe(1);
  });
  it("rejects zero, non-finite amounts with the same code as older sprints", () => {
    expect(() => purchaseLineMath("0", "1", "1")).toThrow("QUANTITY_REJECTED");
    expect(() => purchaseLineMath("1e999", "1", "1")).toThrow();
    expect(() => purchaseLineMath("1", "not-a-number", "1")).toThrow();
    expect(purchaseLineMath("1", "1", null).lineTotalUsd).toBeNull();
  });
  it("does not auto-convert a 12-digit quantity beyond line billion limits", () => {
    expect(() => purchaseLineMath("1", "1", "1000000000000")).toThrow(
      "AMOUNT_OUT_OF_RANGE",
    );
  });
});

describe("purchase FX policy", () => {
  const rate = {
    source: "tcmb" as const,
    value: 50,
    publishedAt: "2026-10-19",
    fetchedAt: "2026-10-19T10:00:00Z",
  };
  it("USD stays identity", () => {
    const fx = purchaseFx("USD", "10", "2026-10-19", null);
    expect(fx.normalizedUsdUnitPrice).toBe("10.000000000");
    expect((fx.fxSnapshot as { source: string }).source).toBe("identity");
  });
  it.each(["EUR", "GBP"])(
    "never converts %s; the manual snapshot stays unverified",
    (currency) => {
      const fx = purchaseFx(currency, "10", "2026-10-19", rate);
      expect(fx.normalizedUsdUnitPrice).toBeNull();
      expect((fx.fxSnapshot as { reason: string }).reason).toBe(
        "CURRENCY_SOURCE_UNVERIFIED",
      );
    },
  );
  it("TRY is normalized through dated TCMB WithRoundHalfUp6", () => {
    const fx = purchaseFx("TRY", "50", "2026-10-19", rate);
    expect(fx.normalizedUsdUnitPrice).toBe("1.000000000");
    const stale = purchaseFx("TRY", "50", "2026-10-19", {
      ...rate,
      source: "manual",
    });
    expect(stale.normalizedUsdUnitPrice).toBeNull();
    expect((stale.fxSnapshot as { reason: string }).reason).toBe(
      "DATED_FX_UNAVAILABLE",
    );
  });
  it("keeps a stale publication unavailable rather than inventing a cross rate", () => {
    expect(
      purchaseFx("TRY", "50", "2026-10-19", {
        ...rate,
        publishedAt: "2026-10-01",
      }).normalizedUsdUnitPrice,
    ).toBeNull();
    expect(
      purchaseFx("TRY", "50", "2026-10-19", null).fxSnapshot,
    ).toMatchObject({
      status: "unavailable",
    });
  });
});

describe("purchase unit conversion reuse", () => {
  it("resolves roll widths through the shared supplier converter", () => {
    const conv = purchaseUnitFactor("linear_meter", {
      roll: true,
      widthCm: "152",
      lengthCm: null,
      material: { unit: "square_meter" },
    });
    expect(conv.factor).toBe("1.52");
    expect(() =>
      purchaseUnitFactor("piece", {
        roll: true,
        widthCm: "152",
        lengthCm: null,
        material: { unit: "square_meter" },
      }),
    ).toThrow("UNIT_CONVERSION_REJECTED");
  });
});

describe("purchase contracts", () => {
  it("F10: rejects a manual currency without a positive manual price", () => {
    expect(
      purchaseLineInput.safeParse({
        supplierMaterialId: "1e2a12ac-1c1d-42ad-9a82-40f5fc8bc4c4",
        orderedQty: "1",
        purchaseUnit: "piece",
        manualCurrency: "USD",
        manualUnitPrice: null,
      }).success,
    ).toBe(false);
  });
  const scope = {
    legalEntityId: "8a9a6c79-5d70-4e21-9a3b-423a15f4f0b3",
    activityId: null,
  };
  const line = {
    supplierMaterialId: "1e2a12ac-1c1d-42ad-9a82-40f5fc8bc4c4",
    orderedQty: "2",
    purchaseUnit: "piece" as const,
  };
  const create = {
    ...scope,
    supplierId: "0b8a966b-98ac-4a75-8964-e019040d8b11",
    idempotencyKey: "a307bdb8-1b32-439b-8ae1-b89af43e14d2",
    lines: [{ ...line, manualCurrency: "TRY", manualUnitPrice: "10" }],
    revisesOrderId: null,
  };
  it("requires exactly one of offer or manual price on every line", () => {
    expect(
      purchaseLineInput.parse({
        ...line,
        offerVersionId: null,
        manualCurrency: "TRY",
        manualUnitPrice: "10",
      }).offerVersionId,
    ).toBeNull();
    expect(() =>
      purchaseLineInput.parse({
        ...line,
        offerVersionId: null,
        manualCurrency: null,
        manualUnitPrice: null,
      }),
    ).toThrow();
    expect(() =>
      purchaseLineInput.parse({
        ...line,
        offerVersionId: "bfa5e0b7-8734-4195-96c9-e7fe03ba4a7a",
        manualCurrency: "TRY",
        manualUnitPrice: "10",
      }),
    ).toThrow();
  });
  it("parses drafts with default revision linkage and action payload shapes", () => {
    const parsed = purchaseOrderCreate.parse(create);
    expect(parsed.revisesOrderId).toBeNull();
    expect(parsed.lines).toHaveLength(1);
  });
  it("rejects overlong line arrays and strict unknown fields", () => {
    expect(() =>
      purchaseOrderCreate.parse({
        ...create,
        lines: Array.from({ length: 51 }, () => ({
          ...line,
          manualCurrency: "USD",
        })),
      }),
    ).toThrow();
    expect(() =>
      purchaseOrderCreate.parse({ ...create, extra: true }),
    ).toThrow();
    expect(() =>
      purchaseOrderEdit.parse({ ...scope, version: "x", lines: [] }),
    ).toThrow();
  });
  it("accumulates statuses only from the lifecycle list and defaults to none", () => {
    expect(parseStatus("")).toEqual([]);
    expect(parseStatus(null)).toEqual([]);
    expect(parseStatus("DRAFT,APPROVED") ?? []).toEqual(["DRAFT", "APPROVED"]);
    expect(() => parseStatus("DRAFT,SMUGGLED")).toThrow();
    expect(purchaseAction.safeParse({ ...scope, version: 0 }).success).toBe(
      false,
    );
    expect(purchaseAction.safeParse({ ...scope, version: 2 }).success).toBe(
      true,
    );
    expect(supplierBusinessDate(new Date("2026-10-18T22:00:00Z"))).toBe(
      "2026-10-19",
    );
  });
});
