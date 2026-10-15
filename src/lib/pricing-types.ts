export type CostUnit = "m²" | "metretül" | "adet" | "plaka";
export interface PriceRevision {
  id: string;
  at: string;
  previous: number | null;
  next: number;
  userId: string;
  userName: string;
}
export interface MaterialVariant {
  archived?: boolean;
  needsConfirmation?: boolean;
  id: string;
  name: string;
  widthCm: number;
  lengthCm?: number;
  inStock: boolean;
  usdCost: number | null;
  history: PriceRevision[];
}
export interface Material {
  sku?: string;
  category?: string;
  brand?: string;
  supplierId?: string;
  materialType?: string;
  vat?: number;
  updatedAt?: string;
  description?: string;
  active?: boolean;
  archived?: boolean;
  needsConfirmation?: boolean;
  margins?: { left: number; right: number; top: number; bottom: number };
  sourcePrice?: {
    amount: number;
    currency: "USD" | "EUR" | "TRY";
    usdTry: number;
    eurTry: number;
    label: string;
  };
  id: string;
  name: string;
  unit: CostUnit;
  roll: boolean;
  variants: MaterialVariant[];
}
export interface ExpenseType {
  id: string;
  name: string;
  unit: string;
  usdAmount: number;
}
export interface PricingCatalog {
  seedVersion?: number;
  suppliers?: { id: string; name: string }[];
  version: 2;
  materials: Material[];
  expenses: ExpenseType[];
}
export interface RateSnapshot {
  eurValue?: number;
  value: number;
  source: "tcmb" | "manual" | "legacy-demo";
  publishedAt: string;
  fetchedAt: string;
  authorizedBy?: string;
  reason?: string;
}
export interface RateResponse {
  rate: RateSnapshot | null;
  stale: boolean;
  error?: string;
  manualEnabled?: boolean;
}
export interface MaterialUse {
  id: string;
  materialId: string;
  variantId: string;
  widthCm: number;
  heightCm: number;
  quantity: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  reusableM2: number;
}
export interface ExpenseUse {
  id: string;
  typeId: string;
  name: string;
  unit: string;
  quantity: number;
  usdAmount: number;
}
export interface PricingInput {
  materials: MaterialUse[];
  expenses: ExpenseUse[];
  method: "margin" | "markup";
  targetPercent: number;
  manualNetUsd: number | null;
  vat: number;
}
export interface MaterialConsumption {
  use: MaterialUse;
  materialName: string;
  variantName: string;
  unit: CostUnit;
  unitCostUsd: number;
  requiredWidthCm: number;
  requiredLengthCm: number;
  rollWidthCm: number;
  consumedUnits: number;
  consumedM2: number;
  printM2: number;
  grossUnusedM2: number;
  reusableM2: number;
  wasteM2: number;
  costUsd: number;
}
export interface CostSnapshot {
  version: 2;
  createdAt: string;
  createdBy: string;
  rate: RateSnapshot;
  materials: MaterialConsumption[];
  expenses: ExpenseUse[];
  input: PricingInput;
  materialCostUsd: number;
  expenseCostUsd: number;
  totalCostUsd: number;
  suggestedNetUsd: number;
  chosenNetUsd: number;
  method: "margin" | "markup";
  targetPercent: number;
}
export interface PricingResult {
  materials: MaterialConsumption[];
  materialCostUsd: number;
  expenseCostUsd: number;
  totalCostUsd: number;
  suggestedNetUsd: number;
  chosenNetUsd: number;
  costTry: number;
  netTry: number;
  vatTry: number;
  totalTry: number;
  profitUsd: number;
  actualMargin: number;
  actualMarkup: number;
}
