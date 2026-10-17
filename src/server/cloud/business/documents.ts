import "server-only";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { database } from "@/server/db/client";
import { identity } from "@/server/auth/core";
import {
  contextFor,
  scoped,
  authorize,
  AccessError,
  type Context,
} from "@/server/authorization/context";
import { fetchTcmb } from "@/lib/tcmb";
import { calculatePricing, pricingSnapshot } from "@/lib/pricing";
import type {
  PricingCatalog,
  RateSnapshot,
  CostUnit,
} from "@/lib/pricing-types";
import * as C from "@/lib/cloud/contracts";
import {
  type Tx,
  type Scope,
  validateScope,
  resource,
  hash,
  lock,
  replay,
  audit,
  can,
} from "./catalog";

const units: Record<string, CostUnit> = {
  square_meter: "m²",
  linear_meter: "metretül",
  piece: "adet",
  sheet: "plaka",
};
const jsonValue = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const money = (v: Decimal.Value, places: number) => {
  const d = new Decimal(v);
  if (!d.isFinite() || d.abs().gte("1000000000000"))
    throw new AccessError(422, "AMOUNT_OUT_OF_RANGE");
  return d.toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
};
async function compute(
  tx: Tx,
  c: Context,
  scope: Scope,
  lines: z.infer<typeof C.lineSchema>[],
  rate: RateSnapshot,
) {
  const output = [];
  for (const line of lines) {
    const product = await tx.cloudProduct.findFirst({
      where: {
        id: line.productId,
        tenantId: c.tenantId,
        legalEntityId: scope.legalEntityId,
        active: true,
      },
    });
    if (
      !product ||
      (product.activityId && product.activityId !== scope.activityId)
    )
      throw new AccessError(422, "PRODUCT_UNAVAILABLE");
    if (
      !can(c, "materials.costView", resource(c, scope)) &&
      line.costing.manualNetUsd === null
    )
      throw new AccessError(403, "MANUAL_PRICE_REQUIRED");
    if (
      !line.costing.materials.length &&
      !line.costing.expenses.length &&
      !(product.kind === "service" && line.zeroCostConfirmed)
    )
      throw new AccessError(422, "COST_REQUIRED");
    const catalog: PricingCatalog = { version: 2, materials: [], expenses: [] };
    const versions = [];
    const costScopes: ReturnType<typeof resource>[] = [];
    for (const use of line.costing.materials) {
      const material = await tx.material.findFirst({
        where: {
          id: use.materialId,
          tenantId: c.tenantId,
          legalEntityId: scope.legalEntityId,
          active: true,
        },
        include: { variants: { where: { id: use.variantId } } },
      });
      const variant = material?.variants[0];
      if (
        !material ||
        !variant ||
        !variant.active ||
        !variant.inStock ||
        variant.usdCost === null ||
        (material.activityId && material.activityId !== scope.activityId)
      )
        throw new AccessError(422, "MATERIAL_COST_UNAVAILABLE");
      if (
        use.quantity !== line.quantity ||
        use.widthCm !== line.widthCm ||
        use.heightCm !== line.heightCm
      )
        throw new AccessError(422, "CONSUMPTION_DIMENSION_MISMATCH");
      if (!units[material.unit]) throw new AccessError(422, "UNIT_UNSUPPORTED");
      costScopes.push({
        tenantId: material.tenantId,
        legalEntityId: material.legalEntityId,
        activityId: material.activityId,
        createdById: material.createdById ?? "",
      });
      if (
        !can(c, "materials.costView", material) &&
        line.costing.manualNetUsd === null
      )
        throw new AccessError(403, "MANUAL_PRICE_REQUIRED");
      const candidate = {
        id: material.id,
        name: material.name,
        unit: units[material.unit],
        roll: material.roll,
        active: true,
        variants: [
          {
            id: variant.id,
            name: variant.name,
            widthCm: variant.widthCm.toNumber(),
            ...(variant.lengthCm
              ? { lengthCm: variant.lengthCm.toNumber() }
              : {}),
            inStock: true,
            usdCost: variant.usdCost.toNumber(),
            history: [],
          },
        ],
      };
      const same = catalog.materials.find((m) => m.id === material.id);
      if (same) {
        if (!same.variants.some((v) => v.id === variant.id))
          same.variants.push(candidate.variants[0]);
      } else catalog.materials.push(candidate);
      versions.push({
        materialId: material.id,
        materialVersion: material.version,
        variantId: variant.id,
        priceVersion: variant.priceVersion,
        usdCost: variant.usdCost.toString(),
        unit: material.unit,
      });
    }
    const expenses = [];
    for (const use of line.costing.expenses) {
      const expense = await tx.cloudExpenseType.findFirst({
        where: {
          id: use.typeId,
          tenantId: c.tenantId,
          legalEntityId: scope.legalEntityId,
          active: true,
        },
      });
      if (
        !expense ||
        (expense.activityId && expense.activityId !== scope.activityId)
      )
        throw new AccessError(422, "EXPENSE_UNAVAILABLE");
      expenses.push({
        id: expense.id,
        typeId: expense.id,
        name: expense.name,
        unit: expense.unit,
        quantity: use.quantity,
        usdAmount: expense.usdAmount.toNumber(),
      });
      costScopes.push({
        tenantId: expense.tenantId,
        legalEntityId: expense.legalEntityId,
        activityId: expense.activityId,
        createdById: expense.createdById,
      });
      if (
        !can(c, "materials.costView", expense) &&
        line.costing.manualNetUsd === null
      )
        throw new AccessError(403, "MANUAL_PRICE_REQUIRED");
      versions.push({
        expenseId: expense.id,
        version: expense.version,
        usdAmount: expense.usdAmount.toString(),
      });
    }
    const input = { ...line.costing, expenses, vat: line.vat };
    let result, snapshot;
    try {
      result = calculatePricing(input, catalog, rate.value);
      snapshot = pricingSnapshot(input, catalog, rate, c.userId);
    } catch {
      throw new AccessError(422, "COST_CALCULATION_INVALID");
    }
    const netUsd = money(
      new Decimal(result.chosenNetUsd).mul(
        new Decimal(1).minus(new Decimal(line.discount).div(100)),
      ),
      6,
    );
    if (new Decimal(netUsd).lte(0))
      throw new AccessError(422, "SALE_PRICE_REQUIRED");
    const netTry = money(new Decimal(netUsd).mul(rate.value), 2),
      vatTry = money(new Decimal(netTry).mul(line.vat).div(100), 2);
    output.push({
      productId: product.id,
      description: line.description,
      quantity: line.quantity,
      widthCm: line.widthCm,
      heightCm: line.heightCm,
      discount: line.discount,
      vat: line.vat,
      costUsd: money(result.totalCostUsd, 6),
      netUsd,
      netTry,
      vatTry,
      totalTry: money(new Decimal(netTry).plus(vatTry), 2),
      snapshot: jsonValue({
        ...snapshot,
        product: {
          id: product.id,
          name: product.name,
          unit: product.unit,
          kind: product.kind,
          version: product.version,
        },
        versions,
        costScopes,
        discount: line.discount,
        realizedProfitUsd: money(
          new Decimal(netUsd).minus(result.totalCostUsd),
          6,
        ),
      }),
    });
  }
  return output;
}
const totals = (lines: Awaited<ReturnType<typeof compute>>) =>
  Object.fromEntries(
    (["costUsd", "netUsd", "netTry", "vatTry", "totalTry"] as const).map(
      (k) => [
        k,
        money(
          lines.reduce((sum, l) => sum.plus(l[k]), new Decimal(0)),
          k.endsWith("Usd") ? 6 : 2,
        ),
      ],
    ),
  ) as Record<"costUsd" | "netUsd" | "netTry" | "vatTry" | "totalTry", string>;

export async function documentRequest(
  headers: Headers,
  path: string[],
  method: string,
  input: unknown,
  query: URLSearchParams,
  db = database(),
  source = identity(),
  rateProvider = fetchTcmb,
) {
  const c = await contextFor(headers, db, source),
    [kind, id] = path;
  const permissionModule = kind === "sales" ? "sales" : "quotes";
  const scope = C.scopeSchema.parse(
    method === "GET"
      ? {
          legalEntityId: query.get("company"),
          activityId: query.get("activity") || null,
        }
      : input,
  );
  if (method === "GET")
    return scoped(
      c,
      async (tx) => {
        await validateScope(tx, c, scope);
        const where = {
          tenantId: c.tenantId,
          legalEntityId: scope.legalEntityId,
          ...(scope.activityId ? { activityId: scope.activityId } : {}),
          ...(id ? { id: z.uuid().parse(id) } : {}),
        };
        const rows =
          kind === "sales"
            ? await tx.cloudSale.findMany({
                where,
                include: { lines: true, plans: true },
                take: 200,
                orderBy: { createdAt: "desc" },
              })
            : await tx.cloudQuote.findMany({
                where,
                take: 200,
                orderBy: { createdAt: "desc" },
              });
        return rows.map((row) => {
          const snapshots =
            "lines" in row
              ? row.lines.map((l) => l.snapshot)
              : (
                  (row.snapshot as { lines?: { snapshot: unknown }[] }).lines ??
                  []
                ).map((l) => l.snapshot);
          const visibleCosts =
            can(c, "materials.costView", row) &&
            snapshots.every((s) =>
              (
                (s as { costScopes?: ReturnType<typeof resource>[] })
                  .costScopes ?? [row]
              ).every((r) => can(c, "materials.costView", r)),
            );
          const publicLines =
            "lines" in row
              ? row.lines.map((l) => ({
                  productId: l.productId,
                  description: l.description,
                  quantity: l.quantity.toString(),
                  widthCm: l.widthCm.toString(),
                  heightCm: l.heightCm.toString(),
                  discount: l.discount.toString(),
                  vat: l.vat.toString(),
                  netUsd: l.netUsd.toString(),
                  netTry: l.netTry.toString(),
                  vatTry: l.vatTry.toString(),
                  totalTry: l.totalTry.toString(),
                }))
              : (
                  (
                    row.snapshot as {
                      lines?: {
                        productId: string;
                        description: string;
                        quantity: number;
                        widthCm: number;
                        heightCm: number;
                        netTry: string;
                        totalTry: string;
                      }[];
                    }
                  ).lines ?? []
                ).map((l) => ({
                  productId: l.productId,
                  description: l.description,
                  quantity: l.quantity,
                  widthCm: l.widthCm,
                  heightCm: l.heightCm,
                  netTry: l.netTry,
                  totalTry: l.totalTry,
                }));
          return {
            id: row.id,
            customerId: row.customerId,
            activityId: row.activityId,
            createdAt: row.createdAt,
            netUsd: row.netUsd.toString(),
            netTry: row.netTry.toString(),
            vatTry: row.vatTry.toString(),
            totalTry: row.totalTry.toString(),
            lines: publicLines,
            ...("revision" in row
              ? {
                  title: row.title,
                  groupId: row.groupId,
                  revision: row.revision,
                }
              : {
                  date: row.date,
                  dueDate: row.dueDate,
                  currency: row.currency,
                  notes: row.notes,
                  plans: row.plans.map((p) => ({
                    dueDate: p.dueDate,
                    method: p.method,
                    amount: p.amount.toString(),
                  })),
                }),
            ...(visibleCosts
              ? {
                  costUsd: row.costUsd.toString(),
                  ...("snapshot" in row
                    ? { snapshot: row.snapshot }
                    : { lines: row.lines, rate: row.rateSnapshot }),
                }
              : {}),
          };
        });
      },
      db,
      scope.legalEntityId,
    );
  if (method !== "POST" || id) throw new AccessError(404, "NOT_FOUND");
  const data =
      kind === "sales" ? C.saleCreate.parse(input) : C.quoteCreate.parse(input),
    digest = hash(data);
  authorize(c, `${permissionModule}.create`, resource(c, scope));
  if (data.lines.some((l) => l.discount > 0))
    authorize(c, "sales.discount", resource(c, scope));
  const existing = await scoped(
    c,
    async (tx) => {
      const where = {
        tenantId: c.tenantId,
        legalEntityId: scope.legalEntityId,
        idempotencyKey: data.idempotencyKey,
      };
      return replay(
        kind === "sales"
          ? await tx.cloudSale.findFirst({ where })
          : await tx.cloudQuote.findFirst({ where }),
        digest,
      );
    },
    db,
    scope.legalEntityId,
  );
  if (existing) return { id: existing.id, replayed: true };
  const rate =
    data.rate.kind === "tcmb"
      ? await rateProvider().catch(() => {
          throw new AccessError(503, "EXCHANGE_RATE_UNAVAILABLE");
        })
      : null;
  if (
    rate &&
    (rate.source !== "tcmb" ||
      !Number.isFinite(rate.value) ||
      rate.value <= 0 ||
      Date.now() - Date.parse(rate.publishedAt) > 7 * 86400000)
  )
    throw new AccessError(422, "EXCHANGE_RATE_STALE");
  return scoped(
    c,
    async (tx) => {
      await validateScope(tx, c, scope);
      await lock(
        tx,
        `${c.tenantId}:${scope.legalEntityId}:${permissionModule}:${data.idempotencyKey}`,
      );
      const where = {
        tenantId: c.tenantId,
        legalEntityId: scope.legalEntityId,
        idempotencyKey: data.idempotencyKey,
      };
      const prior = replay(
        kind === "sales"
          ? await tx.cloudSale.findFirst({ where })
          : await tx.cloudQuote.findFirst({ where }),
        digest,
      );
      if (prior) return { id: prior.id, replayed: true };
      const customer = await tx.customer.findFirst({
        where: {
          id: data.customerId,
          tenantId: c.tenantId,
          legalEntityId: scope.legalEntityId,
          active: true,
        },
      });
      if (
        !customer ||
        (customer.activityId && customer.activityId !== scope.activityId)
      )
        throw new AccessError(422, "CUSTOMER_UNAVAILABLE");
      let usedRate = rate;
      if (data.rate.kind === "manual") {
        authorize(c, "exchange.view", resource(c, scope));
        const manual = await tx.tenantExchangeRate.findFirst({
          where: { id: data.rate.id, tenantId: c.tenantId },
        });
        if (!manual) throw new AccessError(422, "MANUAL_RATE_UNAVAILABLE");
        usedRate = {
          source: "manual",
          value: manual.usdTry.toNumber(),
          publishedAt: manual.publishedAt.toISOString().slice(0, 10),
          fetchedAt: manual.createdAt.toISOString(),
          authorizedBy: manual.actorId,
          reason: manual.reason,
        };
      }
      if (!usedRate) throw new AccessError(422, "EXCHANGE_RATE_REQUIRED");
      const lines = await compute(tx, c, scope, data.lines, usedRate),
        sum = totals(lines);
      const common = {
        ...resource(c, scope),
        customerId: customer.id,
        idempotencyKey: data.idempotencyKey,
        payloadHash: digest,
        ...sum,
      };
      let created;
      if ("plans" in data) {
        if (
          data.dueDate < data.date ||
          data.plans.some((p) => p.dueDate < data.date)
        )
          throw new AccessError(422, "INVALID_DUE_DATE");
        if (
          data.plans.length &&
          !new Decimal(
            money(
              data.plans.reduce((s, p) => s.plus(p.amount), new Decimal(0)),
              2,
            ),
          ).eq(sum.totalTry)
        )
          throw new AccessError(422, "PAYMENT_PLAN_MISMATCH");
        created = await tx.cloudSale.create({
          data: {
            ...common,
            date: new Date(data.date),
            dueDate: new Date(data.dueDate),
            currency: data.currency,
            notes: data.notes,
            rateSnapshot: jsonValue(usedRate),
            lines: {
              create: lines,
            },
            plans: {
              create: data.plans.map((p) => ({
                ...p,
                dueDate: new Date(p.dueDate),
              })),
            },
          },
        });
      } else {
        let groupId: string = randomUUID(),
          revision = 1;
        if (data.previousId) {
          const previous = await tx.cloudQuote.findFirst({
            where: {
              id: data.previousId,
              tenantId: c.tenantId,
              legalEntityId: scope.legalEntityId,
              customerId: customer.id,
              activityId: scope.activityId,
            },
          });
          if (!previous) throw new AccessError(404, "PREVIOUS_QUOTE_NOT_FOUND");
          groupId = previous.groupId;
          await lock(tx, `quote-revision:${groupId}`);
          const latest = await tx.cloudQuote.aggregate({
            where: {
              groupId,
              tenantId: c.tenantId,
              legalEntityId: scope.legalEntityId,
            },
            _max: { revision: true },
          });
          revision = (latest._max.revision ?? 0) + 1;
        }
        created = await tx.cloudQuote.create({
          data: {
            ...common,
            groupId,
            revision,
            title: data.title,
            snapshot: jsonValue({
              version: 1,
              customer: { id: customer.id, name: customer.name },
              rate: usedRate,
              lines,
            }),
          },
        });
      }
      await audit(
        tx,
        c,
        scope,
        `${permissionModule.toUpperCase()}_CREATED`,
        created.id,
      );
      return { id: created.id, replayed: false };
    },
    db,
    scope.legalEntityId,
  );
}
