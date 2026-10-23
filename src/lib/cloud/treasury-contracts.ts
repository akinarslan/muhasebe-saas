import { z } from "zod";
import Decimal from "decimal.js";
import { tryAmount, accountingDate } from "./accounting-contracts";
const scope = {
  legalEntityId: z.uuid(),
  activityId: z.uuid().nullable().default(null),
};
export const operationKinds = [
  "OPEN",
  "DEBT",
  "COLLECT",
  "PAY",
  "SETTLE",
  "EXPENSE",
] as const;
export const intentCreate = z
  .object({
    ...scope,
    kind: z.enum(["SALE", ...operationKinds]),
    clientKey: z.uuid(),
  })
  .strict();
export const fundCreate = z
  .object({
    ...scope,
    kind: z.enum(["CASH", "BANK", "POS"]),
    label: z.string().trim().min(2).max(100),
  })
  .strict();
export const fundAccess = z
  .object({
    ...scope,
    fundAccountId: z.uuid(),
    userId: z.string().min(1).max(200),
    grant: z.boolean(),
  })
  .strict();
export const treasuryOperation = z
  .object({
    ...scope,
    intentId: z.uuid(),
    idempotencyKey: z.uuid(),
    currency: z.literal("TRY"),
    amount: tryAmount.refine((v) => new Decimal(v).gte(0)),
    fee: tryAmount.refine((v) => new Decimal(v).gte(0)).default("0.00"),
    bookedOn: accountingDate,
    dueOn: accountingDate.nullable().default(null),
    accountId: z.uuid().nullable().default(null),
    fundAccountId: z.uuid().nullable().default(null),
    sourceJournalId: z.uuid().nullable().default(null),
    method: z.enum(["CASH", "BANK", "CARD"]).nullable().default(null),
    externalRef: z.string().trim().max(200).default(""),
    terminalApproved: z.boolean().default(false),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()
  .refine((v) => !v.dueOn || v.dueOn >= v.bookedOn, "INVALID_DUE_DATE");

// UI boundary: preserve decimal strings, accept Turkish groups/comma, reject ambiguity.
export function turkishMoney(value: string) {
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(value.trim()))
    throw Error("INVALID_TRY_AMOUNT");
  return tryAmount.parse(value.trim().replaceAll(".", "").replace(",", "."));
}
export function turkishDate(value: string) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!m) throw Error("INVALID_DATE");
  return accountingDate.parse(`${m[3]}-${m[2]}-${m[1]}`);
}
