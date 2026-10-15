import type { Product, Sale, SaleLine } from "./types";
import type { RateSnapshot } from "./pricing-types";
import Decimal from "decimal.js";
export const round = (n: number) =>
  new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
export function lineAmounts(line: SaleLine, product?: Product) {
  const area =
    (line.print ?? product?.print) ? (line.width * line.height) / 10000 : 1;
  const materialArea =
    (line.print ?? product?.print)
      ? ((line.width + 4) * (line.height + 4)) / 10000
      : 1;
  const net = round(
    new Decimal(line.quantity)
      .mul(area)
      .mul(line.price)
      .mul(new Decimal(1).minus(new Decimal(line.discount).div(100)))
      .toNumber(),
  );
  const tax = round(new Decimal(net).mul(line.vat).div(100).toNumber());
  return {
    area,
    materialArea,
    net,
    tax,
    total: round(net + tax),
    cost: line.costSnapshot
      ? new Decimal(line.costSnapshot.totalCostUsd)
          .mul(line.costSnapshot.rate.value)
          .toNumber()
      : (line.legacyCostTry ?? 0),
  };
}
export function saleAmounts(
  sale: Pick<Sale, "lines" | "payments" | "currency"> &
    Pick<Partial<Sale>, "rateSnapshot">,
  products: Product[],
) {
  const amounts = sale.lines.map((l) =>
    lineAmounts(
      l,
      products.find((p) => p.id === l.productId),
    ),
  );
  const net = round(amounts.reduce((s, a) => s + a.net, 0));
  const tax = round(amounts.reduce((s, a) => s + a.tax, 0));
  const total = round(net + tax);
  const paid = round(sale.payments.reduce((s, p) => s + p.amount, 0));
  const cost = sale.lines.reduce((sum, line, index) => {
    if (sale.currency !== "USD") return sum + amounts[index].cost;
    if (line.costSnapshot) return sum + line.costSnapshot.totalCostUsd;
    if (!line.legacyCostTry) return sum;
    if (!sale.rateSnapshot)
      throw new Error("Tarihsel USD maliyeti için kayıtlı kur gerekli.");
    return sum + line.legacyCostTry / sale.rateSnapshot.value;
  }, 0);
  return {
    net,
    tax,
    total,
    paid,
    balance: round(Math.max(0, total - paid)),
    profit: round(net - cost),
  };
}
export const tryValue = (
  value: number,
  currency: string,
  rate?: RateSnapshot,
) => {
  if (currency !== "USD") return value;
  if (!rate || !Number.isFinite(rate.value) || rate.value <= 0)
    throw new Error("USD işleminde kayıtlı kur snapshot’ı gerekli.");
  return new Decimal(value).mul(rate.value).toNumber();
};
export const money = (value: number, currency = "TRY") =>
  !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
export const dateLabel = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("tr-TR");
export const localISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const normalize = (s: unknown) =>
  typeof s === "string"
    ? s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR")
    : "";
export function dateRange(
  period: string,
  today: string,
  start: string,
  end: string,
): [string, string] {
  const d = new Date(today + "T12:00:00");
  if (period === "Özel tarih aralığı") return [start, end];
  if (period === "Bugün") return [today, today];
  if (period === "Bu hafta") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return [localISO(d), today];
  }
  if (period === "Bu ay") return [today.slice(0, 7) + "-01", today];
  return [today.slice(0, 4) + "-01-01", today];
}
