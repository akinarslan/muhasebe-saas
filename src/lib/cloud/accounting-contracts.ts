import { z } from "zod";
import Decimal from "decimal.js";

// Never accept JSON numbers or exponent notation for financial amounts.
export const tryAmount = z
  .string()
  .regex(/^-?(0|[1-9]\d{0,13})(\.\d{1,2})?$/)
  .transform((v) => new Decimal(v).toFixed(2));
export const accountingDate = z.iso.date();
const scope = {
  legalEntityId: z.uuid(),
  activityId: z.uuid().nullable().default(null),
};
export const accountCreate = z
  .object({
    ...scope,
    kind: z.enum(["CUSTOMER", "SUPPLIER"]),
    partyId: z.uuid(),
  })
  .strict();
export const openingCreate = z
  .object({
    ...scope,
    accountId: z.uuid(),
    idempotencyKey: z.uuid(),
    amount: tryAmount,
    currency: z.literal("TRY"),
    bookedOn: accountingDate,
    dueOn: accountingDate.nullable(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()
  .refine((v) => !v.dueOn || v.dueOn >= v.bookedOn, {
    message: "INVALID_DUE_DATE",
  });
export const reversalCreate = z
  .object({
    ...scope,
    journalId: z.uuid(),
    idempotencyKey: z.uuid(),
    bookedOn: accountingDate,
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
