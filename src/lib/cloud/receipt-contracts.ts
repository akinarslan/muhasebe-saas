import { z } from "zod";
import Decimal from "decimal.js";
const Geometry = Decimal.clone({ precision: 60 });
const qty = z
  .string()
  .regex(/^\d{1,15}(\.\d{1,9})?$/)
  .transform((v) => new Decimal(v).toFixed());
export const receiptLine = z
  .object({
    singlePackage: z.literal(true),
    orderLineId: z.uuid(),
    lineNo: z.number().int().positive(),
    receivedQty: qty,
    rejectedQty: qty.default("0"),
    rejectionReason: z.string().trim().max(300).default(""),
  })
  .strict()
  .refine(
    (v) =>
      new Decimal(v.receivedQty).gt(0) &&
      new Decimal(v.rejectedQty).gte(0) &&
      new Decimal(v.rejectedQty).lte(v.receivedQty) &&
      (v.rejectedQty === "0" || v.rejectionReason.length >= 3),
    "INVALID_RECEIVED_QUANTITY",
  );
const scope = {
  legalEntityId: z.uuid(),
  activityId: z.uuid().nullable().default(null),
};
export const receiptCreate = z
  .object({
    ...scope,
    orderId: z.uuid(),
    locationId: z.uuid(),
    receivedAt: z.iso.date(),
    sourceRef: z.string().trim().max(150).default(""),
    idempotencyKey: z.uuid(),
    lines: z.array(receiptLine).min(1).max(50),
  })
  .strict();
export const receiptEdit = z
  .object({
    ...scope,
    version: z.number().int().positive(),
    receivedAt: z.iso.date(),
    sourceRef: z.string().trim().max(150).default(""),
    lines: z.array(receiptLine).min(1).max(50),
  })
  .strict();
export const receiptAction = z
  .object({
    ...scope,
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(300).optional(),
  })
  .strict();
export const locationCreate = z
  .object({
    ...scope,
    code: z.string().trim().min(1).max(30),
    name: z.string().trim().min(2).max(100),
  })
  .strict();
export function stockArea(
  quantity: string,
  width: string | null,
  height: string | null,
  form: string,
) {
  const n = new Geometry(quantity);
  return form === "ROLL" && width
    ? n.mul(width).div(100).toFixed()
    : form === "SHEET" && width && height
      ? n.mul(width).mul(height).div(10000).toFixed()
      : null;
}
