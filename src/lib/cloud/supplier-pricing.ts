import Decimal from "decimal.js";
import { supplierBusinessDate } from "./supplier-date";
import type { RateSnapshot } from "../pricing-types";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export function supplierMinimumBaseQuantity(quantity: string, factor: string) {
  const base = new D(quantity).mul(factor);
  if (!base.isFinite() || base.lte(0) || base.decimalPlaces() > 9)
    throw new Error("UNIT_CONVERSION_REJECTED");
  return base.toFixed();
}
export function unitConversion(
  purchase: string,
  base: string,
  geometry: { roll: boolean; widthCm: string; lengthCm: string | null },
) {
  if (purchase === base) return { factor: "1", baseUnit: base, version: 1 };
  const width = new D(geometry.widthCm).div(100);
  if (!width.isFinite() || width.lte(0))
    throw new Error("UNIT_CONVERSION_REJECTED");
  let factor: Decimal;
  if (geometry.roll && purchase === "linear_meter" && base === "square_meter")
    factor = width;
  else if (
    geometry.roll &&
    purchase === "square_meter" &&
    base === "linear_meter"
  )
    factor = new D(1).div(width);
  else if (
    !geometry.roll &&
    purchase === "sheet" &&
    base === "square_meter" &&
    geometry.lengthCm
  )
    factor = width.mul(new D(geometry.lengthCm).div(100));
  else throw new Error("UNIT_CONVERSION_REJECTED");
  if (!factor.isFinite() || factor.lte(0) || factor.decimalPlaces() > 9)
    throw new Error("UNIT_CONVERSION_REJECTED");
  return {
    version: 1,
    factor: factor.toFixed(),
    baseUnit: base,
    widthCm: geometry.widthCm,
    lengthCm: geometry.lengthCm,
    roll: geometry.roll,
  };
}
export function normalizeSupplierPrice(
  price: string,
  currency: string,
  factor: string,
  offeredOn: string,
  rate: RateSnapshot | null,
  now = new Date(),
) {
  const unavailable = (reason: string) => ({
    normalizedUsdUnitPrice: null,
    fxSnapshot: { status: "unavailable", reason },
  });
  if (currency === "USD")
    return {
      normalizedUsdUnitPrice: new D(price).div(factor).toFixed(9),
      fxSnapshot: {
        status: "verified",
        source: "identity",
        currency: "USD",
        offeredOn,
      },
    };
  if (currency !== "TRY") return unavailable("CURRENCY_SOURCE_UNVERIFIED");
  const age = rate
    ? (Date.parse(supplierBusinessDate(now) + "T00:00:00Z") -
        Date.parse(rate.publishedAt + "T00:00:00Z")) /
      86400000
    : Infinity;
  if (
    !rate ||
    rate.source !== "tcmb" ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 7 ||
    rate.publishedAt > offeredOn ||
    (Date.parse(offeredOn + "T00:00:00Z") -
      Date.parse(rate.publishedAt + "T00:00:00Z")) /
      86400000 >
      7 ||
    !new D(rate.value).isFinite() ||
    new D(rate.value).lte(0)
  )
    return unavailable("DATED_FX_UNAVAILABLE");
  const usdTry = new D(rate.value).toDecimalPlaces(6);
  if (usdTry.lte(0)) return unavailable("DATED_FX_UNAVAILABLE");
  return {
    normalizedUsdUnitPrice: new D(price).div(usdTry).div(factor).toFixed(9),
    fxSnapshot: {
      status: "verified",
      source: "tcmb",
      rateType: "ForexSelling",
      usdTry: usdTry.toFixed(6),
      publishedAt: rate.publishedAt,
      fetchedAt: rate.fetchedAt,
      offeredOn,
    },
  };
}
export type ComparableOffer = {
  id: string;
  supplierMaterialId: string;
  revision: number;
  tierKey: string;
  originalCurrency: string;
  originalUnitPrice?: string;
  normalizedUsdUnitPrice?: string | null;
  conversionSnapshot?: {
    factor: string;
    baseUnit: string;
    minOrderBaseQty?: string;
  };
  minQty?: string;
  maxQty?: string | null;
  offeredOn?: string;
  validFrom: string;
  validUntil: string | null;
  active: boolean;
};
export function compareSupplierOffers<T extends ComparableOffer>(
  rows: T[],
  quantity: string,
  baseUnit: string,
  asOf: string,
) {
  const q = new D(quantity);
  if (!q.isFinite() || q.lte(0)) throw new Error("QUANTITY_REJECTED");
  const latest = new Map<string, number>();
  for (const r of rows)
    if (r.validFrom <= asOf && (!r.offeredOn || r.offeredOn <= asOf)) {
      const key = r.supplierMaterialId + ":" + r.tierKey;
      latest.set(key, Math.max(latest.get(key) ?? 0, r.revision));
    }
  return rows
    .map((r) => {
      const conversion = r.conversionSnapshot;
      let reason =
        r.offeredOn && r.offeredOn > asOf
          ? "OFFER_DATE_AFTER_COMPARISON"
          : r.validFrom <= asOf &&
              latest.get(r.supplierMaterialId + ":" + r.tierKey) !== r.revision
            ? "SUPERSEDED"
            : !r.active
              ? "INACTIVE"
              : r.validFrom > asOf
                ? "NOT_YET_VALID"
                : r.validUntil && r.validUntil <= asOf
                  ? "EXPIRED"
                  : !conversion || conversion.baseUnit !== baseUnit
                    ? "UNIT_UNAVAILABLE"
                    : !r.normalizedUsdUnitPrice ||
                        new D(r.normalizedUsdUnitPrice).lte(0)
                      ? "FX_UNAVAILABLE"
                      : null;
      if (!reason && conversion && r.minQty) {
        const purchaseQty = q.div(conversion.factor);
        if (
          purchaseQty.lt(r.minQty) ||
          (r.maxQty && purchaseQty.gte(r.maxQty)) ||
          (conversion.minOrderBaseQty && q.lt(conversion.minOrderBaseQty))
        )
          reason = "QUANTITY_TIER_MISMATCH";
      }
      return { ...r, comparable: !reason, comparisonReason: reason };
    })
    .sort((a, b) => {
      if (a.comparable !== b.comparable) return a.comparable ? -1 : 1;
      if (a.comparable && b.comparable)
        return (
          new D(a.normalizedUsdUnitPrice!).cmp(b.normalizedUsdUnitPrice!) ||
          a.id.localeCompare(b.id)
        );
      return a.id.localeCompare(b.id);
    });
}
