import Decimal from "decimal.js";
import type { RateSnapshot } from "../pricing-types";
import { normalizeSupplierPrice, unitConversion } from "./supplier-pricing";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const QTY_LIMIT = new D("1000000000000");

export function purchaseUnitFactor(
  purchaseUnit: string,
  geometry: {
    roll: boolean;
    widthCm: string;
    lengthCm: string | null;
    material: { unit: string };
  },
) {
  return unitConversion(purchaseUnit, geometry.material.unit, geometry);
}

// Price is USD per PURCHASE unit. Quantity conversion must be exact at scale 9;
// money is explicitly rounded HALF_UP to scale 9 only at the line total.
export function purchaseLineMath(
  orderedQty: string,
  factor: string,
  normalizedUsdUnitPrice: string | null,
) {
  const qty = new D(orderedQty);
  if (!qty.isFinite() || qty.lte(0) || qty.gte(QTY_LIMIT))
    throw new Error("QUANTITY_REJECTED");
  const f = new D(factor);
  if (!f.isFinite() || f.lte(0) || f.decimalPlaces() > 9)
    throw new Error("UNIT_CONVERSION_REJECTED");
  const base = qty.mul(f);
  if (
    !base.isFinite() ||
    base.lte(0) ||
    base.gte(QTY_LIMIT) ||
    base.decimalPlaces() > 9
  )
    throw new Error("UNIT_CONVERSION_REJECTED");
  let lineTotalUsd: string | null = null;
  if (normalizedUsdUnitPrice) {
    const unit = new D(normalizedUsdUnitPrice);
    if (!unit.isFinite() || unit.lte(0)) throw new Error("FX_UNAVAILABLE");
    const total = qty.mul(unit);
    if (!total.isFinite() || total.gte(QTY_LIMIT))
      throw new Error("AMOUNT_OUT_OF_RANGE");
    lineTotalUsd = total.toDecimalPlaces(9, Decimal.ROUND_HALF_UP).toFixed(9);
  }
  return { orderedBaseQty: base.toFixed(), lineTotalUsd };
}

export function purchaseOrderTotal(lines: { lineTotalUsd: string | null }[]) {
  let sum = new D(0);
  let pending = 0;
  for (const line of lines)
    if (line.lineTotalUsd === null) pending++;
    else sum = sum.add(line.lineTotalUsd);
  return {
    totalUsd: pending ? null : sum.toDecimalPlaces(9).toFixed(9),
    pending,
  };
}

// TCMB is authoritative only for TRY. USD is identity. EUR/GBP stay unconverted.
export function purchaseFx(
  currency: string,
  price: string,
  offeredOn: string,
  rate: RateSnapshot | null,
) {
  if (currency === "USD")
    return {
      currency,
      originalUnitPrice: price,
      normalizedUsdUnitPrice: new D(price).toFixed(9),
      fxSnapshot: {
        status: "verified",
        source: "identity",
        currency,
        offeredOn,
      },
    };
  if (currency !== "TRY")
    return {
      currency,
      originalUnitPrice: price,
      normalizedUsdUnitPrice: null,
      fxSnapshot: {
        status: "unavailable",
        reason: "CURRENCY_SOURCE_UNVERIFIED",
      },
    };
  const normalized = normalizeSupplierPrice(price, "TRY", "1", offeredOn, rate);
  return {
    currency,
    originalUnitPrice: price,
    normalizedUsdUnitPrice: normalized.normalizedUsdUnitPrice,
    fxSnapshot: normalized.fxSnapshot,
  };
}
