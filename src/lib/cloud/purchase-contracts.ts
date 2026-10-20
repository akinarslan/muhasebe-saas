import { z } from "zod";
import { scopeSchema } from "./contracts";
import { supplierUnit, supplierDecimal } from "./supplier-contracts";
export const purchaseDecimal = supplierDecimal;
const positive = purchaseDecimal.refine(
  (s) => /[1-9]/.test(s),
  "Pozitif miktar gerekli",
);
const date = z.iso.date();
export const purchaseCurrency = z.enum(["USD", "TRY", "EUR", "GBP"]);
export const purchaseLineInput = z
  .object({
    supplierMaterialId: z.uuid(),
    offerVersionId: z.uuid().nullable().default(null),
    orderedQty: positive,
    purchaseUnit: supplierUnit,
    expectedDate: date.nullable().default(null),
    manualCurrency: purchaseCurrency.nullable().default(null),
    manualUnitPrice: positive.nullable().default(null),
  })
  .strict()
  .refine(
    (l) => (l.offerVersionId ? !l.manualCurrency : !!l.manualCurrency),
    "Teklif veya manuel fiyat seçilmeli",
  )
  .refine(
    (l) => (l.offerVersionId ? !l.manualUnitPrice : !!l.manualUnitPrice),
    "Manuel fiyat yalnız teklifsiz satırda geçerli",
  );
export type LineInput = z.output<typeof purchaseLineInput>;
export const purchaseOrderCreate = scopeSchema
  .extend({
    supplierId: z.uuid(),
    idempotencyKey: z.uuid(),
    lines: z.array(purchaseLineInput).min(1).max(50),
    revisesOrderId: z.uuid().nullable().default(null),
  })
  .strict();
export const purchaseOrderEdit = scopeSchema
  .extend({
    version: z.number().int().positive(),
    // A redacted manual line can only retain its server-side facts and change
    // delivery metadata. Never accept a hidden price or snapshot from clients.
    lines: z
      .array(
        z.union([
          purchaseLineInput,
          z
            .object({
              preserveLineId: z.uuid(),
              expectedDate: date.nullable().default(null),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(50),
  })
  .strict();
export const purchaseAction = scopeSchema
  .extend({ version: z.number().int().positive() })
  .strict();
export const purchaseStatus = z.enum([
  "DRAFT",
  "APPROVED",
  "CANCELLED",
  "CLOSED",
]);
const statuses = z
  .string()
  .max(40)
  .refine(
    (s) =>
      s
        .split(",")
        .every((part) =>
          ["DRAFT", "APPROVED", "CANCELLED", "CLOSED", ""].includes(part),
        ),
    "Geçersiz sipariş durumu",
  )
  .default("");
export function parseStatus(value: string | null) {
  const parts = statuses.parse(value ?? "");
  return parts.split(",").filter(Boolean) as z.output<typeof purchaseStatus>[];
}
