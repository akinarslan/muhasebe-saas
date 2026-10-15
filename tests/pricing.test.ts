import { describe, it, expect } from "vitest";
import {
  calculatePricing,
  consumeMaterial,
  initialPricingCatalog,
  pricingSnapshot,
  updateMaterialCost,
} from "../src/lib/pricing";
import type {
  MaterialUse,
  PricingInput,
  RateSnapshot,
} from "../src/lib/pricing-types";
import { products, newLine, createDemo } from "../src/lib/mock";
import { saleAmounts } from "../src/lib/finance";
import { migrateDemo, migrateDraft } from "../src/lib/migrate";
const actor = { id: "u1", name: "Test kullanıcı" };
const rate: RateSnapshot = {
  value: 50,
  source: "tcmb",
  publishedAt: "2026-10-15",
  fetchedAt: "2026-10-15T12:00:00Z",
};
const use: MaterialUse = {
  id: "use1",
  materialId: "mat-folyo",
  variantId: "folyo-152",
  widthCm: 135,
  heightCm: 200,
  quantity: 1,
  left: 2,
  right: 2,
  top: 2,
  bottom: 2,
  reusableM2: 0,
};
const base: PricingInput = {
  materials: [use],
  expenses: [],
  method: "margin",
  targetPercent: 30,
  manualNetUsd: null,
  vat: 20,
};
function catalog() {
  return updateMaterialCost(
    initialPricingCatalog(),
    "mat-folyo",
    "folyo-152",
    5,
    actor,
  );
}
describe("USD malzeme ve fiyatlandırma kararları", () => {
  it("aktif ürün fiyat ve maliyetlerini eski listeden doldurmaz", () => {
    expect(products.every((p) => p.price === 0 && p.cost === 0)).toBe(true);
    expect(newLine().price).toBe(0);
    expect(
      initialPricingCatalog().materials.every((m) =>
        m.variants.every((v) => v.usdCost === null),
      ),
    ).toBe(true);
  });
  it("elle USD fiyat güncellemesini önceki değer, tarih ve kullanıcıyla kaydeder", () => {
    const c = updateMaterialCost(catalog(), "mat-folyo", "folyo-152", 7, actor);
    const v = c.materials[0].variants.find((v) => v.id === "folyo-152")!;
    expect(v.usdCost).toBe(7);
    expect(v.history).toHaveLength(2);
    expect(v.history[1]).toMatchObject({
      previous: 5,
      next: 7,
      userId: "u1",
      userName: "Test kullanıcı",
    });
    expect(new Date(v.history[1].at).getTime()).not.toBeNaN();
  });
  it("135 cm baskı için 137 cm ruloyu reddeder", () => {
    const c = updateMaterialCost(catalog(), "mat-folyo", "folyo-137", 5, actor);
    expect(() =>
      consumeMaterial({ ...use, variantId: "folyo-137" }, c.materials[0]),
    ).toThrow("en az 139");
  });
  it("152 cm ruloyla tam 3,1008 m² tüketir", () => {
    const c = consumeMaterial(use, catalog().materials[0]);
    expect(c.requiredWidthCm).toBe(139);
    expect(c.requiredLengthCm).toBe(204);
    expect(c.consumedM2).toBeCloseTo(3.1008, 8);
    expect(c.costUsd).toBeCloseTo(15.504, 8);
    expect(c.grossUnusedM2).toBeCloseTo(0.4008);
    expect(c.reusableM2).toBe(0);
  });
  it("brüt kullanılmayanı yeniden kullanılabilir alandan ayırır", () => {
    const c = consumeMaterial(
      { ...use, reusableM2: 0.2 },
      catalog().materials[0],
    );
    expect(c.grossUnusedM2).toBeCloseTo(0.4008);
    expect(c.wasteM2).toBeCloseTo(0.2008);
    expect(c.costUsd).toBeCloseTo(15.504);
    expect(() =>
      consumeMaterial({ ...use, reusableM2: 1 }, catalog().materials[0]),
    ).toThrow("en fazla");
  });
  it("m² ve metretül maliyetini karıştırmaz", () => {
    const c = catalog();
    const square = consumeMaterial(use, c.materials[0]);
    const linear = consumeMaterial(use, {
      ...c.materials[0],
      unit: "metretül",
    });
    expect(square.consumedUnits).toBeCloseTo(3.1008);
    expect(linear.consumedUnits).toBe(2.04);
    expect(linear.costUsd).toBe(10.2);
  });
  it("plaka ve adet birimlerini destekler", () => {
    const m = {
      ...catalog().materials[0],
      roll: false,
      unit: "plaka" as const,
      variants: [
        { ...catalog().materials[0].variants[3], widthCm: 200, lengthCm: 300 },
      ],
    };
    expect(consumeMaterial({ ...use, quantity: 3 }, m).consumedUnits).toBe(3);
    expect(
      consumeMaterial({ ...use, quantity: 3 }, { ...m, unit: "adet" })
        .consumedUnits,
    ).toBe(3);
  });
  it("diğer uygun ruloları seçebilir; stokta olmayanı reddeder", () => {
    let c = updateMaterialCost(catalog(), "mat-folyo", "folyo-160", 4, actor);
    expect(
      consumeMaterial({ ...use, variantId: "folyo-160" }, c.materials[0])
        .costUsd,
    ).toBeCloseTo(13.056);
    c = {
      ...c,
      materials: c.materials.map((m) => ({
        ...m,
        variants: m.variants.map((v) => ({ ...v, inStock: false })),
      })),
    };
    expect(() => consumeMaterial(use, c.materials[0])).toThrow("Stokta");
  });
  it("malzeme maliyeti değişince yeni hesap yeniden yapılır", () => {
    const old = calculatePricing(base, catalog(), 50);
    const changed = calculatePricing(
      base,
      updateMaterialCost(catalog(), "mat-folyo", "folyo-152", 10, actor),
      50,
    );
    expect(changed.totalCostUsd).toBeCloseTo(old.totalCostUsd * 2);
  });
  it("bir üründe birden çok malzemeyi toplar", () => {
    const result = calculatePricing(
      { ...base, materials: [use, { ...use, id: "use2" }] },
      catalog(),
      50,
    );
    expect(result.materials).toHaveLength(2);
    expect(result.materialCostUsd).toBeCloseTo(31.008);
  });
  it("serbest gider türü ve birimi toplam maliyeti etkiler", () => {
    const result = calculatePricing(
      {
        ...base,
        expenses: [
          {
            id: "e1",
            typeId: "custom",
            name: "Özel vinç hizmeti",
            unit: "saat",
            quantity: 2,
            usdAmount: 10,
          },
          {
            id: "e2",
            typeId: "custom",
            name: "Yol",
            unit: "km",
            quantity: 5,
            usdAmount: 1,
          },
        ],
      },
      catalog(),
      50,
    );
    expect(result.expenseCostUsd).toBe(25);
    expect(result.totalCostUsd).toBeCloseTo(40.504);
  });
  it("brüt marj ve maliyet üstü kâr yöntemlerini ayrı hesaplar", () => {
    const a = calculatePricing({ ...base, targetPercent: 50 }, catalog(), 50);
    const b = calculatePricing(
      { ...base, method: "markup", targetPercent: 50 },
      catalog(),
      50,
    );
    expect(a.suggestedNetUsd).toBeCloseTo(31.008);
    expect(b.suggestedNetUsd).toBeCloseTo(23.256);
    expect(() =>
      calculatePricing({ ...base, targetPercent: 100 }, catalog(), 50),
    ).toThrow("küçük");
  });
  it("manuel satışta gerçek kârı, marjı ve KDVyi ayrı hesaplar", () => {
    const r = calculatePricing({ ...base, manualNetUsd: 20 }, catalog(), 50);
    expect(r.profitUsd).toBeCloseTo(4.496);
    expect(r.actualMargin).toBeCloseTo(22.48);
    expect(r.netTry).toBe(1000);
    expect(r.vatTry).toBe(200);
    expect(r.totalTry).toBe(1200);
  });
  it("kur güncellenince yeni TL hesabı değişir; USD maliyeti değişmez", () => {
    const a = calculatePricing(base, catalog(), 50);
    const b = calculatePricing(base, catalog(), 60);
    expect(b.totalCostUsd).toBe(a.totalCostUsd);
    expect(b.netTry).toBeCloseTo(a.netTry * 1.2, 1);
  });
  it("satış/teklif snapshot’ı malzeme ve kur değişiminden etkilenmez", () => {
    const c = catalog();
    const mutableRate = { ...rate };
    const quote = pricingSnapshot(base, c, mutableRate, "Test");
    const copy = JSON.stringify(quote);
    mutableRate.value = 90;
    c.materials[0].variants[3].usdCost = 100;
    base.materials[0].widthCm = 136;
    expect(JSON.stringify(quote)).toBe(copy);
    base.materials[0].widthCm = 135;
    const sale = {
      ...createDemo().sales[0],
      currency: "TRY" as const,
      rateSnapshot: rate,
      lines: [{ ...newLine(), price: 1500, costSnapshot: quote }],
      payments: [],
    };
    const before = saleAmounts(sale, products);
    expect(
      saleAmounts(
        sale,
        products.map((p) => ({ ...p, cost: 999999 })),
      ),
    ).toEqual(before);
  });
  it("örnek kur yeni snapshot oluşturamaz", () =>
    expect(() =>
      pricingSnapshot(
        base,
        catalog(),
        { ...rate, source: "legacy-demo" },
        "Test",
      ),
    ).toThrow("Örnek kur"));
  it("v0.1 taslak ve satışlarını tutar değiştirmeden taşır", () => {
    const d = createDemo();
    const historical = {
      ...d,
      sales: d.sales.map(({ rateSnapshot: _, legacyDemo: __, ...s }) => {
        void _;
        void __;
        return s;
      }),
    };
    const migrated = migrateDemo(historical);
    expect(migrated.sales[0].rateSnapshot?.source).toBe("legacy-demo");
    expect(migrated.sales[0].lines[0].price).toBe(d.sales[0].lines[0].price);
    expect(migrateDemo(migrated)).toEqual(migrated);
    const draft = migrateDraft({
      activity: "Reklam",
      segment: "Reklamcı",
      customerId: "c1",
      currency: "TRY",
      date: "2026-10-15",
      dueDate: "2026-10-30",
      lines: [
        {
          ...newLine(),
          description: "Korunacak açıklama",
          price: 175,
          priceOrigin: undefined,
        },
      ],
      plans: [],
      paid: 0,
      method: "Nakit",
      notes: "Korunacak not",
    });
    expect(draft.lines[0]).toMatchObject({
      price: 175,
      description: "Korunacak açıklama",
      priceOrigin: "legacy",
    });
  });
});
