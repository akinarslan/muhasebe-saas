import type { DemoData, Draft } from "./types";
// One-time compatibility migration. No active pricing path may use legacy-demo rates.
export function migrateDemo(data: DemoData): DemoData {
  return {
    ...data,
    sales: data.sales.map((s) =>
      s.rateSnapshot
        ? s
        : {
            ...s,
            legacyDemo: true,
            rateSnapshot: {
              value: 42,
              source: "legacy-demo",
              publishedAt: s.date,
              fetchedAt: s.date + "T12:00:00.000Z",
              reason: "v0.1 demo kuru korundu",
            },
            lines: s.lines.map((l) => ({
              ...l,
              priceOrigin: "legacy",
              legacyCostTry:
                l.legacyCostTry ??
                legacyCost(l.productId, l.width, l.height, l.quantity),
            })),
          },
    ),
  };
}
const legacyCosts = [
  95, 65, 1400, 42, 180, 350, 370, 85, 180, 130, 2200, 400, 12000, 32000, 1500,
  550, 19000, 50000, 450, 6500, 9000, 900,
];
const printed = new Set([0, 1, 3, 4, 6, 7, 8, 9]);
function legacyCost(
  id: string,
  width: number,
  height: number,
  quantity: number,
) {
  const i = Number(id.replace("p", "")) - 1;
  return (
    Math.round(
      (printed.has(i) ? ((width + 4) * (height + 4)) / 10000 : 1) *
        quantity *
        (legacyCosts[i] ?? 0) *
        100,
    ) / 100
  );
}
export function migrateDraft(draft: Draft): Draft {
  return {
    ...draft,
    lines: draft.lines.map((l) => ({
      ...l,
      priceOrigin: l.priceOrigin ?? "legacy",
    })),
  };
}
