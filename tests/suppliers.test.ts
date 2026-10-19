import { describe, it, expect } from "vitest";
import { supplierBusinessDate } from "../src/lib/cloud/supplier-date";
import {
  unitConversion,
  normalizeSupplierPrice,
  compareSupplierOffers,
  supplierMinimumBaseQuantity,
} from "../src/lib/cloud/supplier-pricing";
import {
  supplierCreate,
  supplierOfferCreate,
  supplierDecimal,
} from "../src/lib/cloud/supplier-contracts";

describe("supplier pricing and strict contracts", () => {
  it("preserves all 24,9 digits in the frozen MOQ conversion", () =>
    expect(supplierMinimumBaseQuantity("999999999999.123456789", "2")).toBe(
      "1999999999998.246913578",
    ));
  it("rejects MOQ conversion that would require fractional quantity rounding", () =>
    expect(() =>
      supplierMinimumBaseQuantity("999999999999.999999999", "1.52"),
    ).toThrow("UNIT_CONVERSION_REJECTED"));
  it("uses the Istanbul business day across the UTC midnight boundary", () => {
    const instant = new Date("2026-10-18T22:00:00Z");
    expect(supplierBusinessDate(instant)).toBe("2026-10-19");
    expect(
      normalizeSupplierPrice(
        "50",
        "TRY",
        "1",
        "2026-10-19",
        { ...rate, fetchedAt: instant.toISOString() },
        instant,
      ).normalizedUsdUnitPrice,
    ).toBe("1.000000000");
  });
  it("canonicalizes equivalent Decimal strings for idempotent retry", () => {
    expect(supplierDecimal.parse("1.000000000")).toBe(
      supplierDecimal.parse("1"),
    );
    expect(supplierDecimal.parse("10.0100")).toBe("10.01");
  });
  it("does not treat a manual or malformed rate as verified TCMB", () => {
    expect(
      normalizeSupplierPrice(
        "50",
        "TRY",
        "1",
        "2026-10-19",
        { ...rate, source: "manual" },
        now,
      ).normalizedUsdUnitPrice,
    ).toBeNull();
    expect(
      normalizeSupplierPrice(
        "50",
        "TRY",
        "1",
        "2026-10-19",
        { ...rate, publishedAt: "not-a-date" },
        now,
      ).normalizedUsdUnitPrice,
    ).toBeNull();
  });
  const geometry = { roll: true, widthCm: "152", lengthCm: null };
  it("keeps one base price: 15.2 USD per metre = 10 USD per m²", () => {
    const c = unitConversion("linear_meter", "square_meter", geometry);
    expect(c.factor).toBe("1.52");
    expect(
      normalizeSupplierPrice("15.2", "USD", c.factor, "2026-10-19", null)
        .normalizedUsdUnitPrice,
    ).toBe("10.000000000");
  });
  it.each(["kilogram", "litre", "piece"])(
    "rejects %s to area without conversion",
    (unit) =>
      expect(() => unitConversion(unit, "square_meter", geometry)).toThrow(),
  );
  it("rejects inverse conversions not exactly representable in nine places", () =>
    expect(() =>
      unitConversion("square_meter", "linear_meter", geometry),
    ).toThrow());
  it("converts a measured sheet without equating sheets and pieces", () => {
    expect(
      unitConversion("sheet", "square_meter", {
        roll: false,
        widthCm: "100",
        lengthCm: "200",
      }).factor,
    ).toBe("2");
    expect(() => unitConversion("piece", "sheet", geometry)).toThrow();
  });
  const now = new Date("2026-10-19T12:00:00Z");
  const rate = {
    source: "tcmb" as const,
    value: 50,
    publishedAt: "2026-10-19",
    fetchedAt: now.toISOString(),
  };
  it("uses dated TCMB ForexSelling for TRY", () =>
    expect(
      normalizeSupplierPrice("760", "TRY", "1.52", "2026-10-19", rate, now)
        .normalizedUsdUnitPrice,
    ).toBe("10.000000000"));
  it.each(["EUR", "GBP"])("does not invent %s cross rates", (currency) =>
    expect(
      normalizeSupplierPrice("10", currency, "1", "2026-10-19", rate, now)
        .normalizedUsdUnitPrice,
    ).toBeNull(),
  );
  it.each(["2026-10-01", "2026-10-20"])(
    "rejects stale/future publication %s",
    (publishedAt) =>
      expect(
        normalizeSupplierPrice(
          "50",
          "TRY",
          "1",
          "2026-10-19",
          { ...rate, publishedAt },
          now,
        ).normalizedUsdUnitPrice,
      ).toBeNull(),
  );
  it("does not apply a newer FX publication to an older offer", () =>
    expect(
      normalizeSupplierPrice("50", "TRY", "1", "2026-10-18", rate, now)
        .normalizedUsdUnitPrice,
    ).toBeNull());
  const row = {
    id: "a",
    supplierMaterialId: "link",
    revision: 1,
    tierKey: "one",
    originalCurrency: "USD",
    originalUnitPrice: "1",
    normalizedUsdUnitPrice: "1",
    conversionSnapshot: { factor: "1.52", baseUnit: "square_meter" },
    minQty: "10",
    maxQty: "20",
    validFrom: "2026-10-01",
    validUntil: null,
    active: true,
  };
  it("applies quantity tiers in original purchase units", () => {
    expect(
      compareSupplierOffers([row], "15.2", "square_meter", "2026-10-19")[0]
        .comparable,
    ).toBe(true);
    expect(
      compareSupplierOffers([row], "30.4", "square_meter", "2026-10-19")[0]
        .comparisonReason,
    ).toBe("QUANTITY_TIER_MISMATCH");
  });
  it("does not rank cheap expired, inactive or unverified offers first", () => {
    const rows = compareSupplierOffers(
      [
        { ...row, id: "exp", validUntil: "2026-10-19" },
        { ...row, id: "inactive", supplierMaterialId: "x", active: false },
        {
          ...row,
          id: "eur",
          supplierMaterialId: "y",
          normalizedUsdUnitPrice: null,
        },
        {
          ...row,
          id: "valid",
          supplierMaterialId: "z",
          normalizedUsdUnitPrice: "20",
        },
      ],
      "15.2",
      "square_meter",
      "2026-10-19",
    );
    expect(rows[0].id).toBe("valid");
    expect(rows[0].comparable).toBe(true);
    expect(rows.slice(1).every((r) => !r.comparable)).toBe(true);
  });
  it("expired superseding revision does not revive older cheap revision", () => {
    const rows = compareSupplierOffers(
      [row, { ...row, id: "b", revision: 2, validUntil: "2026-10-18" }],
      "15.2",
      "square_meter",
      "2026-10-19",
    );
    expect(rows.find((r) => r.id === "a")?.comparisonReason).toBe("SUPERSEDED");
    expect(rows.every((r) => !r.comparable)).toBe(true);
  });
  it("future revision does not supersede the currently valid one", () =>
    expect(
      compareSupplierOffers(
        [row, { ...row, id: "future", revision: 2, validFrom: "2026-10-20" }],
        "15.2",
        "square_meter",
        "2026-10-19",
      )[0].id,
    ).toBe("a"));
  it("keeps different quantity tiers independent", () =>
    expect(
      compareSupplierOffers(
        [
          row,
          { ...row, id: "tier2", revision: 2, tierKey: "two", minQty: "100" },
        ],
        "15.2",
        "square_meter",
        "2026-10-19",
      )[0].id,
    ).toBe("a"));
  it("respects the frozen supplier MOQ even when the offer tier is lower", () =>
    expect(
      compareSupplierOffers(
        [
          {
            ...row,
            minQty: "1",
            conversionSnapshot: {
              ...row.conversionSnapshot,
              minOrderBaseQty: "100",
            },
          },
        ],
        "15.2",
        "square_meter",
        "2026-10-19",
      )[0].comparisonReason,
    ).toBe("QUANTITY_TIER_MISMATCH"));
  it("does not use an offer issued after the comparison date", () => {
    const r = compareSupplierOffers(
      [row, { ...row, id: "later", revision: 2, offeredOn: "2026-10-20" }],
      "15.2",
      "square_meter",
      "2026-10-19",
    );
    expect(r[0].id).toBe("a");
    expect(r[1].comparisonReason).toBe("OFFER_DATE_AFTER_COMPARISON");
  });
  it("rejects tenant/actor injection into supplier requests", () =>
    expect(
      supplierCreate.safeParse({
        name: "Test",
        legalEntityId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        tenantId: crypto.randomUUID(),
      }).success,
    ).toBe(false));
  it("rejects invalid ranges, nonfinite and excess-precision prices", () => {
    const offer = {
      legalEntityId: crypto.randomUUID(),
      supplierMaterialId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      originalCurrency: "USD",
      originalUnitPrice: "1",
      purchaseUnit: "piece",
      minQty: "1",
      offeredOn: "2026-10-19",
      validFrom: "2026-10-19",
    };
    for (const price of ["NaN", "Infinity", "-1", "0", "1.1234567891"])
      expect(
        supplierOfferCreate.safeParse({ ...offer, originalUnitPrice: price })
          .success,
      ).toBe(false);
    expect(
      supplierOfferCreate.safeParse({ ...offer, validUntil: "2026-10-19" })
        .success,
    ).toBe(false);
  });
});
