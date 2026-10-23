import { z } from "zod";
export const scopeSchema = z.object({
  legalEntityId: z.uuid(),
  activityId: z.uuid().nullable().default(null),
});
const label = z.string().trim().min(1).max(200);
export const amount = z.string().regex(/^\d{1,9}(\.\d{1,6})?$/);
export const customerFields = z.object({
  name: label,
  segment: z
    .enum(["Resmî kurum", "Reklamcı", "Mağaza-İşyeri"])
    .default("Mağaza-İşyeri"),
  city: z.string().max(100).default(""),
  district: z.string().max(100).default(""),
  phone: z.string().max(25).default(""),
  email: z.union([z.email(), z.literal("")]).default(""),
  taxOffice: z.string().max(150).default(""),
  taxId: z
    .string()
    .regex(/^(\d{10,11})?$/)
    .default(""),
  contact: z.string().max(200).default(""),
  address: z.string().max(1000).default(""),
  notes: z.string().max(3000).default(""),
  term: z.number().int().min(0).max(365).default(30),
  active: z.boolean().default(true),
});
export const customerCreate = scopeSchema
  .extend(customerFields.shape)
  .extend({ idempotencyKey: z.uuid() })
  .strict();
export const customerEdit = scopeSchema
  .extend(customerFields.shape)
  .extend({ version: z.number().int().positive() })
  .strict();
export const variantSchema = z
  .object({
    id: z.uuid().optional(),
    name: label,
    widthCm: z.number().finite().min(0).max(100000),
    lengthCm: z.number().finite().positive().max(100000).optional(),
    inStock: z.boolean(),
    active: z.boolean().default(true),
    usdCost: amount.nullable(),
    priceVersion: z.number().int().positive().optional(),
  })
  .strict();
export const materialFields = z.object({
  name: label,
  unit: z.enum(["square_meter", "linear_meter", "piece", "sheet"]),
  roll: z.boolean(),
  category: z.string().max(200).default(""),
  brand: z.string().max(200).default(""),
  supplierReference: z.string().max(200).default(""),
  sku: z.string().max(100).default(""),
  description: z.string().max(3000).default(""),
  vat: z.number().min(0).max(100).default(20),
  margins: z.object({
    left: z.number().min(0).max(100),
    right: z.number().min(0).max(100),
    top: z.number().min(0).max(100),
    bottom: z.number().min(0).max(100),
  }),
  active: z.boolean().default(true),
});
export const materialCreate = scopeSchema
  .extend(materialFields.shape)
  .extend({
    idempotencyKey: z.uuid(),
    variants: z.array(variantSchema).min(1).max(100),
  })
  .strict();
export const materialEdit = scopeSchema
  .extend(materialFields.shape)
  .extend({ version: z.number().int().positive() })
  .strict();
export const productFields = z.object({
  name: label,
  category: z.string().max(200).default(""),
  unit: label,
  kind: z.enum(["service", "manufacture", "resale"]),
  active: z.boolean().default(true),
});
export const productCreate = scopeSchema
  .extend(productFields.shape)
  .extend({ idempotencyKey: z.uuid() })
  .strict();
export const productEdit = scopeSchema
  .extend(productFields.shape)
  .extend({ version: z.number().int().positive() })
  .strict();
export const expenseCreate = scopeSchema
  .extend({
    idempotencyKey: z.uuid(),
    name: label,
    unit: label,
    usdAmount: amount,
    active: z.boolean().default(true),
  })
  .strict();
export const useSchema = z
  .object({
    id: z.string().min(1).max(100),
    materialId: z.uuid(),
    variantId: z.uuid(),
    widthCm: z.number().finite().positive().max(100000),
    heightCm: z.number().finite().positive().max(100000),
    quantity: z.number().finite().positive().max(100000),
    left: z.number().min(0).max(100),
    right: z.number().min(0).max(100),
    top: z.number().min(0).max(100),
    bottom: z.number().min(0).max(100),
    reusableM2: z.number().finite().min(0).max(100000),
  })
  .strict();
export const costingSchema = z
  .object({
    materials: z.array(useSchema).max(50),
    expenses: z
      .array(
        z
          .object({
            typeId: z.uuid(),
            quantity: z.number().finite().min(0).max(100000),
          })
          .strict(),
      )
      .max(50),
    method: z.enum(["margin", "markup"]),
    targetPercent: z.number().finite().min(0).max(10000),
    manualNetUsd: z.number().finite().min(0).max(1e9).nullable(),
    vat: z.number().finite().min(0).max(100),
  })
  .strict();
export const rateChoice = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tcmb") }),
  z.object({ kind: z.literal("manual"), id: z.uuid() }),
]);
export const lineSchema = z
  .object({
    productId: z.uuid(),
    description: z.string().max(1000),
    quantity: z.number().finite().positive().max(100000),
    widthCm: z.number().finite().min(0).max(100000),
    heightCm: z.number().finite().min(0).max(100000),
    discount: z.number().finite().min(0).max(100),
    vat: z.number().finite().min(0).max(100),
    zeroCostConfirmed: z.boolean().default(false),
    costing: costingSchema,
  })
  .strict();
const date = z.iso.date();
export const quoteCreate = scopeSchema
  .extend({
    customerId: z.uuid(),
    title: label,
    idempotencyKey: z.uuid(),
    previousId: z.uuid().optional(),
    rate: rateChoice,
    lines: z.array(lineSchema).min(1).max(50),
  })
  .strict();
export const saleCreate = scopeSchema
  .extend({
    customerId: z.uuid(),
    sourceRef: z.string().trim().min(1).max(200).optional(),
    idempotencyKey: z.uuid(),
    date,
    dueDate: date,
    currency: z.enum(["USD", "TRY"]),
    notes: z.string().max(3000),
    rate: rateChoice,
    lines: z.array(lineSchema).min(1).max(50),
    plans: z
      .array(
        z
          .object({
            dueDate: date,
            method: z.enum([
              "Nakit",
              "Havale/EFT",
              "Kredi kartı",
              "Mail order",
              "Çek",
              "Senet",
            ]),
            amount: amount,
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
