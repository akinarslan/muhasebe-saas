import Decimal from "decimal.js";
import type { PricingCatalog, Material } from "./pricing-types";
const refs: [string, string, number, "USD" | "EUR" | "TRY"][] = [
  ["vinil", "Vinil", 1.2, "USD"],
  ["siyah-vinil", "Arkası siyah vinil", 1.25, "USD"],
  ["billboard", "Billboard kâğıdı", 0.36, "EUR"],
  ["raket", "Raket kâğıdı", 0.44, "EUR"],
  ["mgbond", "MGBond kompozit", 16, "USD"],
  ["mgbond-6", "MGBond kompozit 6 metre", 16.5, "USD"],
  ["pleksi-beyaz", "Şeffaf/beyaz pleksi 2,8 mm", 24, "USD"],
  ["pleksi-renkli", "Renkli pleksi 2,8 mm", 26, "USD"],
  ["oracal-beyaz", "Oracal arkası beyaz parlak", 80, "TRY"],
  ["oracal-gri", "Oracal arkası gri parlak", 80.85, "TRY"],
  ["oracal-mat", "Oracal arkası gri mat", 80.85, "TRY"],
];
export function seedCatalog(catalog: PricingCatalog): PricingCatalog {
  const materials = [...catalog.materials];
  for (const [key, name, amount, currency] of refs) {
    if (
      materials.some(
        (m) =>
          m.id === `seed-${key}` ||
          m.name.trim().toLocaleLowerCase("tr") ===
            name.toLocaleLowerCase("tr"),
      )
    )
      continue;
    const cost = new Decimal(amount)
      .mul(currency === "EUR" ? 55.411 : 1)
      .div(currency === "USD" ? 1 : 49.4204)
      .toDecimalPlaces(10)
      .toNumber();
    const roll =
      key.includes("vinil") ||
      key.includes("oracal") ||
      key === "billboard" ||
      key === "raket";
    const widths =
      key === "vinil"
        ? [140]
        : key.startsWith("oracal")
          ? [105, 126, 137, 152, 160, 200]
          : [];
    const mat: Material = {
      id: `seed-${key}`,
      sku: `REF-${key.toUpperCase()}`,
      name,
      unit: "m²",
      roll,
      active: true,
      needsConfirmation: widths.length === 0,
      category: roll ? "Baskı malzemesi" : "Levha",
      brand: key.startsWith("oracal")
        ? "Oracal"
        : key.startsWith("mgbond")
          ? "MGBond"
          : "",
      vat: 20,
      materialType: roll ? "Rulo" : "Plaka",
      updatedAt: "2026-10-15T00:00:00Z",
      margins: { left: 2, right: 2, top: 2, bottom: 2 },
      sourcePrice: {
        amount,
        currency,
        usdTry: 49.4204,
        eurTry: 55.411,
        label: "Kullanıcı başlangıç referansı · 15.10.2026 · canlı kur değil",
      },
      variants: (widths.length ? widths : [0]).map((w) => ({
        id: `seed-${key}-${w}`,
        name: w ? `${w} cm` : "Ölçü onayı gerekli",
        widthCm: w,
        inStock: widths.length > 0,
        needsConfirmation: !w,
        usdCost: cost,
        history: [
          {
            id: `seed-history-${key}-${w}`,
            at: "2026-10-15T00:00:00Z",
            previous: null,
            next: cost,
            userId: "user-reference",
            userName: "Kullanıcı başlangıç referansı",
          },
        ],
      })),
    };
    materials.push(mat);
  }
  return {
    ...catalog,
    materials,
    seedVersion: 1,
    suppliers: catalog.suppliers ?? [],
  };
}
