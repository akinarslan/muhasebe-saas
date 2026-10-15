import Decimal from "decimal.js";
export function parseNumeric(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s || !/^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s)) return null;
  try {
    const n = new Decimal(s.replace(",", ".")).toNumber();
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
export const decimal = (n: Decimal.Value) => new Decimal(n);
export const numericValue = (raw: string) => parseNumeric(raw) ?? Number.NaN;
