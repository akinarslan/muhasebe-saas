import { z } from "zod";
import { scopeSchema } from "./contracts";

const text = (n: number) => z.string().trim().max(n);
export const supplierUnit = z.enum([
  "square_meter",
  "linear_meter",
  "piece",
  "sheet",
  "kilogram",
  "litre",
]);
export const supplierDecimal = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,9})?$/)
  .transform((value) =>
    value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value,
  );
const positive = supplierDecimal.refine(
  (s) => /[1-9]/.test(s),
  "Pozitif miktar gerekli",
);
const date = z.iso.date();
export const supplierFields = z.object({
  name: text(200).min(2),
  tradeName: text(200).default(""),
  phone: text(30).default(""),
  email: z.union([z.email(), z.literal("")]).default(""),
  taxOffice: text(150).default(""),
  taxId: z
    .string()
    .regex(/^(?:\d{10,11})?$/)
    .default(""),
  city: text(100).default(""),
  district: text(100).default(""),
  address: text(1000).default(""),
  contact: text(200).default(""),
  defaultCurrency: z.enum(["USD", "TRY", "EUR", "GBP"]).default("USD"),
  leadTimeDays: z.number().int().min(0).max(3650).default(0),
  notes: text(3000).default(""),
  active: z.boolean().default(true),
});
export const supplierCreate = scopeSchema
  .extend(supplierFields.shape)
  .extend({ idempotencyKey: z.uuid() })
  .strict();
export const supplierEdit = scopeSchema
  .extend(supplierFields.shape)
  .extend({ version: z.number().int().positive() })
  .strict();
export const supplierLinkFields = z.object({
  supplierSku: text(120).default(""),
  purchaseUnit: supplierUnit,
  minOrderQty: positive,
  leadTimeDays: z.number().int().min(0).max(3650),
  active: z.boolean().default(true),
});
export const supplierLinkCreate = scopeSchema
  .extend(supplierLinkFields.shape)
  .extend({ variantId: z.uuid(), idempotencyKey: z.uuid() })
  .strict();
export const supplierLinkEdit = scopeSchema
  .extend(supplierLinkFields.shape)
  .extend({ version: z.number().int().positive() })
  .strict();
export const supplierOfferCreate = scopeSchema
  .extend({
    supplierMaterialId: z.uuid(),
    idempotencyKey: z.uuid(),
    originalCurrency: z.enum(["USD", "TRY", "EUR", "GBP"]),
    originalUnitPrice: positive,
    purchaseUnit: supplierUnit,
    minQty: positive,
    maxQty: positive.nullable().default(null),
    offeredOn: date,
    validFrom: date,
    validUntil: date.nullable().default(null),
    supplierReference: text(200).default(""),
    notes: text(3000).default(""),
  })
  .strict()
  .refine(
    (s) => !s.validUntil || s.validUntil > s.validFrom,
    "Geçerlilik aralığı hatalı",
  );
