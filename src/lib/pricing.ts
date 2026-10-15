import { createId, copyValue } from "./runtime";
import type {
  CostSnapshot,
  Material,
  MaterialConsumption,
  MaterialUse,
  PricingCatalog,
  PricingInput,
  PricingResult,
  RateSnapshot,
} from "./pricing-types";
import { round } from "./finance";
import Decimal from "decimal.js";
export function initialPricingCatalog(): PricingCatalog {
  return {
    version: 2,
    materials: [
      {
        id: "mat-folyo",
        name: "Baskı folyosu",
        unit: "m²",
        roll: true,
        variants: [105, 126, 137, 152, 160, 200].map((widthCm) => ({
          id: `folyo-${widthCm}`,
          name: `Standart · ${widthCm} cm`,
          widthCm,
          inStock: true,
          usdCost: null,
          history: [],
        })),
      },
    ],
    expenses: [
      "Mürekkep",
      "İşçilik",
      "Elektrik",
      "Makine kullanım/amortismanı",
      "Kesim",
      "Laminasyon",
      "Montaj",
      "Nakliye",
      "Diğer giderler",
    ].map((name, i) => ({
      id: `expense-${i}`,
      name,
      unit: i === 1 ? "saat" : "iş",
      usdAmount: 0,
    })),
  };
}
function finite(n: number, name: string, min = 0) {
  if (!Number.isFinite(n) || n < min)
    throw new Error(`${name} geçerli ve ${min} veya üstü olmalıdır.`);
}
export function consumeMaterial(
  use: MaterialUse,
  material: Material,
): MaterialConsumption {
  const variant = material.variants.find((v) => v.id === use.variantId);
  if (!variant) throw new Error("Malzeme varyantı seçin.");
  if (
    material.archived ||
    material.active === false ||
    variant.archived ||
    variant.needsConfirmation
  )
    throw new Error("Malzeme aktif değil veya ölçü onayı gerekiyor.");
  if (!variant.inStock) throw new Error("Stokta olmayan varyant kullanılamaz.");
  if (variant.usdCost === null)
    throw new Error(`${material.name} için USD alış maliyetini girin.`);
  finite(variant.usdCost, "USD maliyeti");
  finite(use.widthCm, "Baskı eni", 0.01);
  finite(use.heightCm, "Baskı boyu", 0.01);
  finite(use.quantity, "Adet", 1);
  if (!Number.isInteger(use.quantity))
    throw new Error("Malzeme adedi tam sayı olmalıdır.");
  for (const key of ["left", "right", "top", "bottom", "reusableM2"] as const)
    finite(use[key], "Pay / yeniden kullanılabilir alan");
  const requiredWidthCm = new Decimal(use.widthCm)
    .plus(use.left)
    .plus(use.right)
    .toNumber();
  const requiredLengthCm = new Decimal(use.heightCm)
    .plus(use.top)
    .plus(use.bottom)
    .toNumber();
  const printM2 = new Decimal(use.widthCm)
    .mul(use.heightCm)
    .div(10000)
    .mul(use.quantity)
    .toNumber();
  let consumedM2 = new Decimal(requiredWidthCm)
    .mul(requiredLengthCm)
    .div(10000)
    .mul(use.quantity)
    .toNumber();
  let consumedUnits = use.quantity;
  let recoverableLimit = 0;
  if (material.roll) {
    finite(variant.widthCm, "Rulo genişliği", 0.01);
    if (variant.widthCm < requiredWidthCm)
      throw new Error(
        `${variant.widthCm} cm rulo uygun değil; en az ${requiredWidthCm} cm gerekiyor.`,
      );
    consumedM2 = new Decimal(variant.widthCm)
      .mul(requiredLengthCm)
      .div(10000)
      .mul(use.quantity)
      .toNumber();
    recoverableLimit =
      (((variant.widthCm - requiredWidthCm) * requiredLengthCm) / 10000) *
      use.quantity;
  }
  if (material.unit === "m²") consumedUnits = consumedM2;
  if (material.unit === "metretül") {
    if (!material.roll)
      throw new Error("Metretül maliyeti için rulo malzeme gerekir.");
    consumedUnits = new Decimal(requiredLengthCm)
      .div(100)
      .mul(use.quantity)
      .toNumber();
  }
  if (
    material.unit === "plaka" ||
    (!material.roll && material.materialType === "Plaka")
  ) {
    if (material.roll) throw new Error("Plaka malzeme rulo olamaz.");
    const length = variant.lengthCm ?? 0;
    finite(variant.widthCm, "Plaka eni", 0.01);
    finite(length, "Plaka boyu", 0.01);
    const perSheet =
      Math.floor(variant.widthCm / requiredWidthCm) *
      Math.floor(length / requiredLengthCm);
    if (perSheet < 1) throw new Error("Ölçüler seçilen plakaya sığmıyor.");
    const sheets = Math.ceil(use.quantity / perSheet);
    consumedM2 = new Decimal(sheets)
      .mul(variant.widthCm)
      .mul(length)
      .div(10000)
      .toNumber();
    consumedUnits = material.unit === "plaka" ? sheets : consumedM2;
    recoverableLimit = Math.max(
      0,
      consumedM2 -
        ((requiredWidthCm * requiredLengthCm) / 10000) * use.quantity,
    );
  }
  const grossUnusedM2 = Math.max(0, consumedM2 - printM2);
  if (use.reusableM2 > recoverableLimit + 1e-8)
    throw new Error(
      `Yeniden kullanılabilir alan en fazla ${recoverableLimit.toFixed(4)} m² olabilir; kenar kesimleri buna dahil değildir.`,
    );
  return {
    use: { ...use },
    materialName: material.name,
    variantName: variant.name,
    unit: material.unit,
    unitCostUsd: variant.usdCost,
    requiredWidthCm,
    requiredLengthCm,
    rollWidthCm: variant.widthCm,
    consumedUnits,
    consumedM2,
    printM2,
    grossUnusedM2,
    reusableM2: use.reusableM2,
    wasteM2: Math.max(0, grossUnusedM2 - use.reusableM2),
    costUsd: new Decimal(consumedUnits).mul(variant.usdCost).toNumber(),
  };
}
export function calculatePricing(
  input: PricingInput,
  catalog: PricingCatalog,
  rate: number,
): PricingResult {
  finite(rate, "USD/TRY kuru", 0.0001);
  finite(input.targetPercent, "Hedef kâr");
  finite(input.vat, "KDV");
  if (input.vat > 100) throw new Error("KDV en fazla %100 olabilir.");
  if (input.method === "margin" && input.targetPercent >= 100)
    throw new Error("Brüt kâr marjı %100’den küçük olmalıdır.");
  if (input.targetPercent > 10000) throw new Error("Kâr hedefi çok yüksek.");
  const materials = input.materials.map((u) => {
    const m = catalog.materials.find((m) => m.id === u.materialId);
    if (!m) throw new Error("Malzeme bulunamadı.");
    return consumeMaterial(u, m);
  });
  const materialCostUsd = materials.reduce(
    (s, m) => new Decimal(s).plus(m.costUsd).toNumber(),
    0,
  );
  const expenseCostUsd = input.expenses.reduce((s, e) => {
    finite(e.quantity, "Gider miktarı");
    finite(e.usdAmount, "Gider USD tutarı");
    if (!e.name.trim() || !e.unit.trim())
      throw new Error("Gider adı ve birimi gereklidir.");
    return new Decimal(s)
      .plus(new Decimal(e.quantity).mul(e.usdAmount))
      .toNumber();
  }, 0);
  const totalCostUsd = new Decimal(materialCostUsd)
    .plus(expenseCostUsd)
    .toNumber();
  finite(totalCostUsd, "Hesaplanan USD maliyeti");
  const suggestedNetUsd =
    input.method === "margin"
      ? new Decimal(totalCostUsd)
          .div(new Decimal(1).minus(new Decimal(input.targetPercent).div(100)))
          .toNumber()
      : new Decimal(totalCostUsd)
          .mul(new Decimal(1).plus(new Decimal(input.targetPercent).div(100)))
          .toNumber();
  if (input.manualNetUsd !== null)
    finite(input.manualNetUsd, "Manuel net satış");
  const chosenNetUsd = input.manualNetUsd ?? suggestedNetUsd;
  const profitUsd = new Decimal(chosenNetUsd).minus(totalCostUsd).toNumber();
  const netTry = round(new Decimal(chosenNetUsd).mul(rate).toNumber());
  finite(netTry, "TL satış toplamı");
  const vatTry = round(new Decimal(netTry).mul(input.vat).div(100).toNumber());
  return {
    materials,
    materialCostUsd,
    expenseCostUsd,
    totalCostUsd,
    suggestedNetUsd,
    chosenNetUsd,
    costTry: round(new Decimal(totalCostUsd).mul(rate).toNumber()),
    netTry,
    vatTry,
    totalTry: round(netTry + vatTry),
    profitUsd,
    actualMargin:
      chosenNetUsd > 0
        ? new Decimal(profitUsd).div(chosenNetUsd).mul(100).toNumber()
        : 0,
    actualMarkup:
      totalCostUsd > 0
        ? new Decimal(profitUsd).div(totalCostUsd).mul(100).toNumber()
        : 0,
  };
}
export function pricingSnapshot(
  input: PricingInput,
  catalog: PricingCatalog,
  rate: RateSnapshot,
  userName: string,
): CostSnapshot {
  if (rate.source === "legacy-demo")
    throw new Error("Örnek kur yeni fiyatlandırmada kullanılamaz.");
  const result = calculatePricing(input, catalog, rate.value);
  return copyValue({
    version: 2,
    createdAt: new Date().toISOString(),
    createdBy: userName,
    rate,
    materials: result.materials,
    expenses: input.expenses,
    input,
    materialCostUsd: result.materialCostUsd,
    expenseCostUsd: result.expenseCostUsd,
    totalCostUsd: result.totalCostUsd,
    suggestedNetUsd: result.suggestedNetUsd,
    chosenNetUsd: result.chosenNetUsd,
    method: input.method,
    targetPercent: input.targetPercent,
  });
}
export function updateMaterialCost(
  catalog: PricingCatalog,
  materialId: string,
  variantId: string,
  cost: number,
  actor: { id: string; name: string },
): PricingCatalog {
  finite(cost, "USD alış maliyeti");
  const next = copyValue(catalog);
  const v = next.materials
    .find((m) => m.id === materialId)
    ?.variants.find((v) => v.id === variantId);
  if (!v) throw new Error("Varyant bulunamadı.");
  if (v.usdCost !== cost) {
    v.history.push({
      id: createId(),
      at: new Date().toISOString(),
      previous: v.usdCost,
      next: cost,
      userId: actor.id,
      userName: actor.name,
    });
    v.usdCost = cost;
  }
  return next;
}
