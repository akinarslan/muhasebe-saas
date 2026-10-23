import { z } from "zod";
import Decimal from "decimal.js";
import { accountingDate, tryAmount } from "./accounting-contracts";

export const expenseCategories = {
  RENT: "Kira",
  ELECTRICITY: "Elektrik",
  STAFF: "Personel giderleri",
  TRANSPORT: "Nakliye",
  MAINTENANCE: "Makine bakım",
  CONSUMABLES: "Mürekkep ve sarf giderleri",
  INSTALLATION: "Montaj",
  OTHER: "Diğer işletme giderleri",
} as const;
export const expenseCreate = z
  .object({
    legalEntityId: z.uuid(),
    activityId: z.uuid().nullable().default(null),
    intentId: z.uuid(),
    idempotencyKey: z.uuid(),
    currency: z.literal("TRY"),
    category: z.enum(
      Object.keys(expenseCategories) as [
        keyof typeof expenseCategories,
        ...(keyof typeof expenseCategories)[],
      ],
    ),
    description: z.string().trim().min(3).max(500),
    documentRef: z.string().trim().min(3).max(200),
    bookedOn: accountingDate,
    dueOn: accountingDate.nullable().default(null),
    net: tryAmount.refine((v) => new Decimal(v).gt(0)),
    vat: tryAmount.refine((v) => new Decimal(v).gte(0)),
    supplierId: z.uuid().nullable().default(null),
    payment: z.enum(["CASH", "BANK", "CREDIT"]),
    fundAccountId: z.uuid().nullable().default(null),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      !tryAmount.safeParse(v.net).success ||
      !tryAmount.safeParse(v.vat).success
    )
      return;
    if (new Decimal(v.net).plus(v.vat).gt("99999999999999.99"))
      ctx.addIssue({ code: "custom", message: "AMOUNT_OVERFLOW" });
    if (v.dueOn && v.dueOn < v.bookedOn)
      ctx.addIssue({ code: "custom", message: "INVALID_DUE_DATE" });
    if (
      v.payment === "CREDIT"
        ? !v.supplierId || !v.dueOn || v.fundAccountId
        : !v.fundAccountId
    )
      ctx.addIssue({ code: "custom", message: "INVALID_EXPENSE_PAYMENT" });
  });
export const financeRange = z
  .object({ from: accountingDate, through: accountingDate })
  .refine((v) => v.from <= v.through, "INVALID_DATE_RANGE");
