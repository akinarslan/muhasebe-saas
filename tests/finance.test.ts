import { describe, it, expect } from "vitest";
import {
  lineAmounts,
  saleAmounts,
  dateRange,
  tryValue,
} from "../src/lib/finance";
import { createDemo, products, newLine } from "../src/lib/mock";
import { draftSchema } from "../src/lib/validation";
import cities from "../src/data/cities.json";
describe("Demo finansal hesapları", () => {
  it("2 cm payı her kenara ekler; satışa yalnızca net alanı yansıtır", () => {
    const l = {
      ...newLine(products[0]),
      width: 100,
      height: 200,
      quantity: 2,
      price: 100,
      discount: 10,
      vat: 20,
    };
    const a = lineAmounts(l, products[0]);
    expect(a.area).toBe(2);
    expect(a.materialArea).toBeCloseTo(2.1216);
    expect(a.net).toBe(360);
    expect(a.tax).toBe(72);
    expect(a.total).toBe(432);
  });
  it("tahsilatları aynı satış toplamından düşer", () => {
    const d = createDemo();
    d.sales.forEach((s) => {
      const a = saleAmounts(s, products);
      expect(a.total).toBeCloseTo(a.paid + a.balance, 2);
      expect(a.balance).toBeGreaterThanOrEqual(0);
    });
  });
  it("yeterli ve tutarlı örnek kayıt sunar", () => {
    const d = createDemo();
    expect(d.customers.length).toBeGreaterThanOrEqual(30);
    expect(d.sales.length).toBeGreaterThanOrEqual(50);
    expect(products.length).toBeGreaterThanOrEqual(20);
    expect(
      d.sales.every((s) => d.customers.some((c) => c.id === s.customerId)),
    ).toBe(true);
    expect(new Set(d.customers.map((c) => c.segment)).size).toBe(3);
  });
  it("haftayı pazartesiden başlatır ve özel tarih aralığını korur", () => {
    expect(dateRange("Bu hafta", "2026-10-15", "", "")).toEqual([
      "2026-10-12",
      "2026-10-15",
    ]);
    expect(
      dateRange("Özel tarih aralığı", "2026-10-15", "2026-01-02", "2026-02-03"),
    ).toEqual(["2026-01-02", "2026-02-03"]);
  });
  it("USD dönüşümünde işlem snapshot’ını kullanır; varsayılan kur kabul etmez", () => {
    expect(
      tryValue(100, "USD", {
        value: 49.5,
        source: "tcmb",
        publishedAt: "2026-10-15",
        fetchedAt: "2026-10-15T12:00:00Z",
      }),
    ).toBe(4950);
    expect(() => tryValue(100, "USD")).toThrow("snapshot");
  });
  it("81 il ve gerçek ilçelerini içerir", () => {
    expect(cities).toHaveLength(81);
    expect(cities.find((c) => c.name === "İstanbul")?.districts).toContain(
      "Kadıköy",
    );
    expect(cities.every((c) => c.districts.length > 0)).toBe(true);
  });
  it("müşterisiz ve ürünsüz taslağı reddeder", () => {
    expect(draftSchema.safeParse({}).success).toBe(false);
  });
});
