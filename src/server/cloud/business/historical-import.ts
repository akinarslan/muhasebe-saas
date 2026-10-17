import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import {
  type Context,
  authorize,
  AccessError,
} from "@/server/authorization/context";
import { calculatePricing, pricingSnapshot } from "@/lib/pricing";
import { amount, costingSchema } from "@/lib/cloud/contracts";
import type { PricingCatalog, CostUnit } from "@/lib/pricing-types";
import { type Scope, type Tx, resource } from "./catalog";
const label = z.string().min(1).max(200);
const rate = z
  .object({
    value: z.number().finite().positive().max(100000),
    source: z.enum(["tcmb", "manual"]),
    publishedAt: z.iso.date(),
    fetchedAt: z.iso.datetime(),
    reason: z.string().max(500).optional(),
  })
  .strict();
const historicalMaterial = z
  .object({
    id: z.uuid(),
    name: label,
    unit: z.enum(["square_meter", "linear_meter", "piece", "sheet"]),
    roll: z.boolean(),
    variants: z
      .array(
        z
          .object({
            id: z.uuid(),
            name: label,
            widthCm: z.number().min(0).max(100000),
            lengthCm: z.number().positive().max(100000).optional(),
            usdCost: amount,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const historicalSchema = z
  .object({
    customerSourceId: label,
    title: label,
    date: z.iso.date(),
    dueDate: z.iso.date(),
    currency: z.enum(["TRY", "USD"]),
    rate,
    lines: z
      .array(
        z
          .object({
            productSourceId: label,
            description: z.string().max(1000),
            quantity: z.number().positive().max(100000),
            widthCm: z.number().min(0).max(100000),
            heightCm: z.number().min(0).max(100000),
            discount: z.number().min(0).max(100),
            vat: z.number().min(0).max(100),
            zeroCostConfirmed: z.boolean().default(false),
            costing: costingSchema,
            catalog: z
              .object({
                materials: z.array(historicalMaterial).max(50),
                expenses: z
                  .array(
                    z
                      .object({
                        id: z.uuid(),
                        name: label,
                        unit: label,
                        usdAmount: amount,
                      })
                      .strict(),
                  )
                  .max(50),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    expected: z
      .object({
        costUsd: amount,
        netUsd: amount,
        netTry: amount,
        vatTry: amount,
        totalTry: amount,
      })
      .strict(),
    plans: z
      .array(
        z.object({
          dueDate: z.iso.date(),
          method: z.enum([
            "Nakit",
            "Havale/EFT",
            "Kredi kartı",
            "Mail order",
            "Çek",
            "Senet",
          ]),
          amount,
        }),
      )
      .max(100)
      .default([]),
  })
  .strict();
const units: Record<string, CostUnit> = {
  square_meter: "m²",
  linear_meter: "metretül",
  piece: "adet",
  sheet: "plaka",
};
export function validateHistorical(input: unknown) {
  const data = historicalSchema.parse(input),
    lines: {
      productSourceId: string;
      description: string;
      quantity: number;
      widthCm: number;
      heightCm: number;
      discount: number;
      vat: number;
      costUsd: string;
      netUsd: string;
      netTry: string;
      vatTry: string;
      totalTry: string;
      snapshot: ReturnType<typeof pricingSnapshot> & {
        historical: boolean;
        originalCatalog: z.infer<
          typeof historicalSchema
        >["lines"][number]["catalog"];
      };
    }[] = [];
  if (data.dueDate < data.date) throw new AccessError(422, "INVALID_DUE_DATE");
  for (const l of data.lines) {
    const catalog: PricingCatalog = {
      version: 2,
      materials: l.catalog.materials.map((m) => ({
        ...m,
        unit: units[m.unit],
        variants: m.variants.map((v) => ({
          ...v,
          usdCost: Number(v.usdCost),
          inStock: true,
          history: [],
        })),
      })),
      expenses: l.catalog.expenses.map((e) => ({
        ...e,
        usdAmount: Number(e.usdAmount),
      })),
    };
    const expenses = l.costing.expenses.map((e) => {
      const rate = catalog.expenses.find((r) => r.id === e.typeId);
      if (!rate) throw new AccessError(422, "HISTORICAL_EXPENSE_MISSING");
      return { ...rate, id: rate.id, typeId: rate.id, quantity: e.quantity };
    });
    if (!l.costing.materials.length && !expenses.length && !l.zeroCostConfirmed)
      throw new AccessError(422, "COST_REQUIRED");
    if (
      l.costing.materials.some(
        (m) =>
          m.widthCm !== l.widthCm ||
          m.heightCm !== l.heightCm ||
          m.quantity !== l.quantity,
      )
    )
      throw new AccessError(422, "CONSUMPTION_DIMENSION_MISMATCH");
    const normalized = { ...l.costing, expenses, vat: l.vat };
    const result = calculatePricing(normalized, catalog, data.rate.value),
      snapshot = pricingSnapshot(
        normalized,
        catalog,
        data.rate,
        "historical-import",
      );
    const netUsd = new Decimal(result.chosenNetUsd)
      .mul(new Decimal(1).minus(new Decimal(l.discount).div(100)))
      .toFixed(6);
    const netTry = new Decimal(netUsd).mul(data.rate.value).toFixed(2),
      vatTry = new Decimal(netTry).mul(l.vat).div(100).toFixed(2);
    lines.push({
      productSourceId: l.productSourceId,
      description: l.description,
      quantity: l.quantity,
      widthCm: l.widthCm,
      heightCm: l.heightCm,
      discount: l.discount,
      vat: l.vat,
      costUsd: new Decimal(result.totalCostUsd).toFixed(6),
      netUsd,
      netTry,
      vatTry,
      totalTry: new Decimal(netTry).plus(vatTry).toFixed(2),
      snapshot: { ...snapshot, historical: true, originalCatalog: l.catalog },
    });
  }
  const sum = Object.fromEntries(
    (["costUsd", "netUsd", "netTry", "vatTry", "totalTry"] as const).map(
      (k) => [
        k,
        lines
          .reduce((a, l) => a.plus(l[k]), new Decimal(0))
          .toFixed(k.endsWith("Usd") ? 6 : 2),
      ],
    ),
  ) as typeof data.expected;
  for (const key of Object.keys(sum) as (keyof typeof sum)[])
    if (!new Decimal(sum[key]).eq(data.expected[key]))
      throw new AccessError(422, "HISTORICAL_TOTAL_MISMATCH");
  if (
    data.plans.length &&
    !data.plans
      .reduce((a, p) => a.plus(p.amount), new Decimal(0))
      .eq(sum.totalTry)
  )
    throw new AccessError(422, "PAYMENT_PLAN_MISMATCH");
  return { data, lines, sum };
}
export async function createHistorical(
  tx: Tx,
  c: Context,
  s: Scope,
  kind: "sale" | "quote",
  input: unknown,
  key: string,
  digest: string,
) {
  authorize(
    c,
    kind === "sale" ? "sales.create" : "quotes.create",
    resource(c, s),
  );
  authorize(c, "materials.costEdit", resource(c, s));
  authorize(c, "materials.costView", resource(c, s));
  const { data, lines, sum } = validateHistorical(input);
  const mapping = async (type: string, sourceId: string) => {
    const row = await tx.cloudImportRecord.findFirst({
      where: {
        tenantId: c.tenantId,
        legalEntityId: s.legalEntityId,
        kind: type,
        sourceId,
      },
    });
    if (!row) throw new AccessError(422, "IMPORT_REFERENCE_UNRESOLVED");
    return row.targetId;
  };
  const customerId = await mapping("customer", data.customerSourceId);
  const customer = await tx.customer.findFirst({
    where: {
      id: customerId,
      tenantId: c.tenantId,
      legalEntityId: s.legalEntityId,
    },
  });
  if (
    !customer ||
    (customer.activityId && customer.activityId !== s.activityId)
  )
    throw new AccessError(422, "IMPORT_REFERENCE_REJECTED");
  const mapped = [];
  for (const l of lines) {
    const productId = await mapping("product", l.productSourceId),
      product = await tx.cloudProduct.findFirst({
        where: {
          id: productId,
          tenantId: c.tenantId,
          legalEntityId: s.legalEntityId,
        },
      });
    if (!product || (product.activityId && product.activityId !== s.activityId))
      throw new AccessError(422, "IMPORT_REFERENCE_REJECTED");
    const { productSourceId, ...line } = l;
    void productSourceId;
    mapped.push({
      ...line,
      productId,
      snapshot: JSON.parse(
        JSON.stringify({
          ...line.snapshot,
          product: { id: product.id, name: product.name, unit: product.unit },
        }),
      ) as Prisma.InputJsonValue,
    });
  }
  const common = {
    ...resource(c, s),
    customerId,
    idempotencyKey: key,
    payloadHash: digest,
    ...sum,
  };
  if (kind === "quote")
    return tx.cloudQuote.create({
      data: {
        ...common,
        title: data.title,
        groupId: randomUUID(),
        revision: 1,
        snapshot: JSON.parse(
          JSON.stringify({
            historical: true,
            originalDate: data.date,
            originalDueDate: data.dueDate,
            currency: data.currency,
            rate: data.rate,
            lines: mapped,
          }),
        ),
      },
    });
  return tx.cloudSale.create({
    data: {
      ...common,
      date: new Date(data.date),
      dueDate: new Date(data.dueDate),
      currency: data.currency,
      notes: data.title,
      rateSnapshot: { ...data.rate, historical: true },
      lines: { create: mapped },
      plans: {
        create: data.plans.map((p) => ({ ...p, dueDate: new Date(p.dueDate) })),
      },
    },
  });
}
