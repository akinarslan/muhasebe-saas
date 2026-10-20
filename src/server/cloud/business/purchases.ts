import "server-only";
import Decimal from "decimal.js";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { supplierBusinessDate } from "@/lib/cloud/supplier-date";
import { Prisma, SupplierUnit } from "@/generated/prisma/client";
import { database } from "@/server/db/client";
import { identity } from "@/server/auth/core";
import { requireMfa } from "@/server/auth/mfa";
import {
  contextFor,
  scoped,
  authorize,
  AccessError,
  type Context,
} from "@/server/authorization/context";
import { scopeSchema } from "@/lib/cloud/contracts";
import * as C from "@/lib/cloud/purchase-contracts";
import {
  purchaseFx,
  purchaseLineMath,
  purchaseOrderTotal,
  purchaseUnitFactor,
} from "@/lib/cloud/purchase-pricing";
import { fetchTcmb } from "@/lib/tcmb";
import type { RateSnapshot } from "@/lib/pricing-types";
import {
  audit,
  can,
  hash,
  lock,
  replay,
  validateScope,
  resource,
  type Tx,
  type Scope,
} from "./catalog";

const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
const day = (d: Date) => d.toISOString().slice(0, 10);
const forceUnit = (value: string) => value as SupplierUnit;

async function orderFor(
  tx: Tx,
  c: Context,
  s: Scope,
  id: string,
  write = false,
) {
  if (write)
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${id}::uuid AND "tenantId"=${c.tenantId}::uuid AND "legalEntityId"=${s.legalEntityId}::uuid FOR UPDATE`;
  const row = await tx.purchaseOrder.findFirst({
    where: { id, tenantId: c.tenantId, legalEntityId: s.legalEntityId },
    include: { supplier: true },
  });
  if (!row) throw new AccessError(404, "PURCHASE_ORDER_NOT_FOUND");
  authorize(c, "purchases.view", row);
  if (s.activityId && row.activityId && s.activityId !== row.activityId)
    throw new AccessError(404, "PURCHASE_ORDER_NOT_FOUND");
  return row;
}

function supplierMinimum(
  link: { minOrderQty: Prisma.Decimal },
  factor: string,
) {
  return new Money(link.minOrderQty.toString()).mul(factor).toFixed();
}

// Line resolution validates scope, activity, offer tier and FX, then freezes
// exact Decimal conversion and price facts into JSON snapshots.
async function resolveLine(
  tx: Tx,
  c: Context,
  where: { tenantId: string; legalEntityId: string },
  input: C.LineInput,
  rateRef: { rate: RateSnapshot | null | undefined },
) {
  const link = await tx.supplierMaterial.findFirst({
    where: { ...where, id: input.supplierMaterialId },
  });
  if (!link) throw new AccessError(404, "SUPPLIER_MATERIAL_NOT_FOUND");
  const supplier = await tx.supplier.findFirst({
    where: { ...where, id: link.supplierId },
  });
  if (!supplier) throw new AccessError(404, "SUPPLIER_NOT_FOUND");
  authorize(c, "suppliers.view", supplier);
  if (!supplier.active || !link.active)
    throw new AccessError(422, "SUPPLIER_UNAVAILABLE");
  const variant = await tx.materialVariant.findFirst({
    where: { ...where, id: link.variantId },
    include: { material: true },
  });
  if (!variant || !variant.active || !variant.material.active)
    throw new AccessError(422, "MATERIAL_UNAVAILABLE");
  let factor: string;
  try {
    factor = purchaseUnitFactor(input.purchaseUnit, {
      roll: variant.material.roll,
      widthCm: variant.widthCm.toString(),
      lengthCm: variant.lengthCm ? variant.lengthCm.toString() : null,
      material: { unit: variant.material.unit },
    }).factor;
  } catch {
    throw new AccessError(422, "UNIT_CONVERSION_REJECTED");
  }
  const variantUsdCost = variant.usdCost ? variant.usdCost.toString() : null;
  // TCMB is consulted at most once per request, and only for TRY lines.
  const rateFor = async (currency: string) => {
    if (currency === "TRY" && rateRef.rate === undefined)
      rateRef.rate = await fetchTcmb().catch(() => null);
  };
  const today = supplierBusinessDate();
  let fx: ReturnType<typeof purchaseFx>;
  let offerRevision: number | null = null;
  // Passing null means "no rate resolved"; undefined would mean "not consulted".
  const resolvedRate = () => rateRef.rate ?? null;
  if (input.offerVersionId) {
    const offer = await tx.supplierOfferVersion.findFirst({
      where: { ...where, id: input.offerVersionId },
    });
    if (!offer || offer.supplierMaterialId !== link.id)
      throw new AccessError(404, "SUPPLIER_OFFER_NOT_FOUND");
    if (
      day(offer.offeredOn) > today ||
      day(offer.validFrom) > today ||
      (offer.validUntil && day(offer.validUntil) <= today)
    )
      throw new AccessError(422, "OFFER_UNAVAILABLE");
    const qty = new Money(input.orderedQty);
    if (qty.lt(offer.minQty) || (offer.maxQty && qty.gte(offer.maxQty)))
      throw new AccessError(422, "QUANTITY_TIER_MISMATCH");
    if (input.purchaseUnit !== offer.purchaseUnit)
      throw new AccessError(422, "OFFER_UNIT_MISMATCH");
    // Offer geometry and FX belong to that immutable version, not today's rate.
    const frozen = offer.conversionSnapshot as Prisma.JsonObject;
    if (
      typeof frozen.factor !== "string" ||
      frozen.baseUnit !== variant.material.unit
    )
      throw new AccessError(422, "UNIT_CONVERSION_REJECTED");
    factor = frozen.factor;
    offerRevision = offer.revision;
    const offerFx = offer.fxSnapshot as Prisma.JsonObject;
    let usd: string | null = null;
    if (offer.originalCurrency === "USD")
      usd = offer.originalUnitPrice.toFixed(9);
    else if (
      offer.originalCurrency === "TRY" &&
      offerFx?.status === "verified" &&
      offerFx.source === "tcmb" &&
      typeof offerFx.usdTry === "string"
    )
      usd = new Money(offer.originalUnitPrice.toString())
        .div(offerFx.usdTry)
        .toFixed(9);
    fx = {
      currency: offer.originalCurrency,
      originalUnitPrice: offer.originalUnitPrice.toString(),
      normalizedUsdUnitPrice: usd,
      fxSnapshot: offer.fxSnapshot as ReturnType<
        typeof purchaseFx
      >["fxSnapshot"],
    };
  } else {
    // Manual prices require their own authorization before lines are resolved.
    await rateFor(input.manualCurrency!);
    fx = purchaseFx(
      input.manualCurrency!,
      input.manualUnitPrice!,
      today,
      resolvedRate(),
    );
  }
  let math: ReturnType<typeof purchaseLineMath>;
  try {
    math = purchaseLineMath(
      input.orderedQty,
      factor,
      fx.normalizedUsdUnitPrice,
    );
  } catch {
    throw new AccessError(422, "UNIT_CONVERSION_REJECTED");
  }
  if (
    new Money(math.orderedBaseQty).lt(
      supplierMinimum(
        link,
        purchaseUnitFactor(link.purchaseUnit, {
          roll: variant.material.roll,
          widthCm: variant.widthCm.toString(),
          lengthCm: variant.lengthCm?.toString() ?? null,
          material: { unit: variant.material.unit },
        }).factor,
      ),
    )
  )
    throw new AccessError(422, "QUANTITY_TIER_MISMATCH");
  return {
    supplierMaterialId: link.id,
    offerVersionId: input.offerVersionId,
    variantId: variant.id,
    orderedQty: input.orderedQty,
    purchaseUnit: forceUnit(input.purchaseUnit),
    expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
    orderedBaseQty: math.orderedBaseQty,
    baseUnit: forceUnit(variant.material.unit),
    conversionSnapshot: json({
      version: 1,
      factor,
      baseUnit: variant.material.unit,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierSku: link.supplierSku,
      minOrderBaseQty: supplierMinimum(link, factor),
      leadTimeDays: link.leadTimeDays,
      variantName: variant.name,
      materialName: variant.material.name,
      variantUsdCost,
    }),
    priceSnapshot: json({
      version: 1,
      roundingVersion: "HALF_UP_9",
      source: input.offerVersionId ? "OFFER" : "MANUAL",
      offerRevision,
      originalCurrency: fx.currency,
      originalUnitPrice: fx.originalUnitPrice,
      purchaseUnit: input.purchaseUnit,
      factor,
      usdPurchaseUnitPrice: fx.normalizedUsdUnitPrice,
      normalizedUsdUnitPrice:
        fx.normalizedUsdUnitPrice === null
          ? null
          : new Money(fx.normalizedUsdUnitPrice).div(factor).toFixed(9),
      lineTotalUsd: math.lineTotalUsd,
      variantUsdCost,
      fxSnapshot: fx.fxSnapshot,
      recordedById: c.userId,
      pricedOn: today,
    }),
  };
}

function lineDto(
  row: Prisma.PurchaseOrderLineGetPayload<object>,
  detail: { variantName: string | null; materialName: string | null },
  withCosts: boolean,
  withMaterialCosts: boolean,
) {
  const conv = row.conversionSnapshot as Prisma.JsonObject;
  const price = row.priceSnapshot as Prisma.JsonObject;
  const text = (key: string) => {
    const value = price[key];
    return typeof value === "string" ? value : null;
  };
  return {
    id: row.id,
    lineNo: row.lineNo,
    supplierMaterialId: row.supplierMaterialId,
    offerVersionId: row.offerVersionId,
    variantId: row.variantId,
    supplierId: typeof conv.supplierId === "string" ? conv.supplierId : null,
    supplierSku: typeof conv.supplierSku === "string" ? conv.supplierSku : "",
    variantName: detail.variantName ?? "",
    materialName: detail.materialName ?? "",
    orderedQty: row.orderedQty.toString(),
    purchaseUnit: row.purchaseUnit,
    orderedBaseQty: row.orderedBaseQty.toString(),
    baseUnit: row.baseUnit,
    expectedDate: row.expectedDate ? day(row.expectedDate) : null,
    priceSource: typeof price.source === "string" ? price.source : null,
    offerRevision:
      typeof price.offerRevision === "number" ? price.offerRevision : null,
    originalCurrency: text("originalCurrency"),
    ...(withCosts
      ? {
          originalUnitPrice: text("originalUnitPrice"),
          normalizedUsdUnitPrice: text("normalizedUsdUnitPrice"),
          lineTotalUsd: text("lineTotalUsd"),
          ...(withMaterialCosts
            ? { variantUsdCost: text("variantUsdCost") }
            : {}),
          fxSnapshot:
            typeof price.fxSnapshot === "object" && price.fxSnapshot !== null
              ? price.fxSnapshot
              : null,
        }
      : {}),
  };
}

async function orderDto(
  tx: Tx,
  c: Context,
  row: Prisma.PurchaseOrderGetPayload<{ include: { supplier: true } }>,
  withLines: boolean,
) {
  const lines = await tx.purchaseOrderLine.findMany({
    where: { tenantId: c.tenantId, orderId: row.id },
    orderBy: { lineNo: "asc" },
    take: 51,
  });
  if (lines.length > 50) throw new AccessError(422, "ORDER_LINES_OVERFLOW");
  const withCosts = can(c, "purchases.costView", row);
  const variants = lines.length
    ? await tx.materialVariant.findMany({
        where: {
          tenantId: c.tenantId,
          legalEntityId: row.legalEntityId,
          id: { in: [...new Set(lines.map((l) => l.variantId))] },
        },
        include: { material: true },
      })
    : [];
  const byId = new Map(variants.map((v) => [v.id, v]));
  const computed = purchaseOrderTotal(
    lines.map((l) => {
      const price = l.priceSnapshot as Prisma.JsonObject;
      return {
        lineTotalUsd:
          typeof price.lineTotalUsd === "string" ? price.lineTotalUsd : null,
      };
    }),
  );
  const head = {
    id: row.id,
    activityId: row.activityId,
    supplierId: row.supplierId,
    supplierName: row.supplier.name,
    businessNo: row.businessNo,
    revision: row.revision,
    revisesOrderId: row.revisesOrderId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    approvedById: row.approvedById,
    version: row.version,
    lineCount: lines.length,
    ...(withCosts
      ? { totalUsd: computed.totalUsd, pendingLines: computed.pending }
      : {}),
  };
  if (!withLines) return head;
  return {
    ...head,
    lines: lines.map((l) =>
      lineDto(
        l,
        {
          variantName: byId.get(l.variantId)?.name ?? null,
          materialName: byId.get(l.variantId)?.material.name ?? null,
        },
        withCosts,
        withCosts &&
          !!byId.get(l.variantId) &&
          can(c, "materials.costView", byId.get(l.variantId)!.material),
      ),
    ),
  };
}

async function allocatedNumber(
  tx: Tx,
  where: { tenantId: string; legalEntityId: string },
) {
  const year = new Date().getFullYear();
  await lock(
    tx,
    `${where.tenantId}:${where.legalEntityId}:purchase-order-no:${year}`,
  );
  // Counts under RLS cannot see other owners' orders. Use opaque candidates;
  // the company-wide unique index is authoritative, with whole-tx retry below.
  let candidate = `PO-${year}-${String(randomInt(1, 10000)).padStart(4, "0")}`;
  for (let i = 1; i <= 20; i++) {
    const clash = await tx.purchaseOrder.findFirst({
      where: { ...where, businessNo: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `PO-${year}-${String(randomInt(1, 10000)).padStart(4, "0")}`;
  }
  throw new AccessError(409, "ORDER_NUMBER_EXHAUSTED");
}

export async function purchaseRequest(
  headers: Headers,
  path: string[],
  method: string,
  input: unknown,
  query: URLSearchParams,
  db = database(),
  source = identity(),
  attempt = 0,
): Promise<unknown> {
  const c = await contextFor(headers, db, source);
  const s = scopeSchema.parse(
    method === "GET"
      ? {
          legalEntityId: query.get("company"),
          activityId: query.get("activity") || null,
        }
      : input,
  );
  const [kind, id, sub] = path;
  if (id) z.uuid().parse(id);
  try {
    return await scoped(
      c,
      async (tx) => {
        await validateScope(tx, c, s);
        const where = { tenantId: c.tenantId, legalEntityId: s.legalEntityId };
        if (kind !== "purchase-orders") throw new AccessError(404, "NOT_FOUND");
        if (path.length === 1 && method === "GET") {
          const status = C.parseStatus(query.get("status")),
            supplierId = query.get("supplier"),
            q = query.get("q")?.trim().slice(0, 30) ?? "";
          const rows = await tx.purchaseOrder.findMany({
            where: {
              ...where,
              ...(s.activityId
                ? { OR: [{ activityId: null }, { activityId: s.activityId }] }
                : {}),
              ...(status.length ? { status: { in: status } } : {}),
              ...(supplierId
                ? z.uuid().safeParse(supplierId).success
                  ? { supplierId }
                  : { id: supplierId }
                : {}),
              ...(q ? { businessNo: { contains: q } } : {}),
            },
            include: { supplier: true },
            orderBy: { createdAt: "desc" },
            take: 501,
          });
          if (rows.length > 500)
            throw new AccessError(422, "RESULT_LIMIT_NARROW_FILTER");
          const counts = await tx.purchaseOrderLine.groupBy({
            by: ["orderId"],
            where: { ...where, orderId: { in: rows.map((r) => r.id) } },
            _count: { _all: true },
          });
          const lineCounts = new Map(
            counts.map((r) => [r.orderId, r._count._all]),
          );
          return rows
            .filter((r) => can(c, "purchases.view", r))
            .map((r) => ({
              id: r.id,
              activityId: r.activityId,
              supplierId: r.supplierId,
              supplierName: r.supplier.name,
              businessNo: r.businessNo,
              revision: r.revision,
              status: r.status,
              createdAt: r.createdAt.toISOString(),
              approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
              version: r.version,
              lineCount: lineCounts.get(r.id) ?? 0,
            }));
        }
        if (path.length === 1 && method === "POST") {
          const body = C.purchaseOrderCreate.parse(input);
          if (body.revisesOrderId)
            throw new AccessError(422, "REVISION_FLOW_PENDING");
          const supplier = await tx.supplier.findFirst({
            where: { ...where, id: body.supplierId },
          });
          if (!supplier) throw new AccessError(404, "SUPPLIER_NOT_FOUND");
          authorize(c, "suppliers.view", supplier);
          if (!supplier.active)
            throw new AccessError(422, "SUPPLIER_UNAVAILABLE");
          const scopeResource = resource(c, s);
          authorize(c, "purchases.view", scopeResource);
          if (body.lines.some((l) => !l.offerVersionId))
            authorize(c, "purchases.costView", scopeResource);
          authorize(c, "purchases.create", scopeResource);
          const digest = hash(body);
          await lock(
            tx,
            `${c.tenantId}:${s.legalEntityId}:purchase-order:${body.idempotencyKey}`,
          );
          const old = replay(
            await tx.purchaseOrder.findFirst({
              where: { ...where, idempotencyKey: body.idempotencyKey },
            }),
            digest,
          );
          if (old) {
            authorize(c, "purchases.view", old);
            return { id: old.id };
          }
          const businessNo = await allocatedNumber(tx, where);
          const rateRef: { rate: RateSnapshot | null | undefined } = {
            rate: undefined,
          };
          const resolved: Awaited<ReturnType<typeof resolveLine>>[] = [];
          for (const line of body.lines)
            resolved.push(await resolveLine(tx, c, where, line, rateRef));
          const order = await tx.purchaseOrder.create({
            data: {
              tenantId: c.tenantId,
              legalEntityId: s.legalEntityId,
              activityId: s.activityId,
              createdById: c.userId,
              idempotencyKey: body.idempotencyKey,
              payloadHash: digest,
              supplierId: supplier.id,
              businessNo,
              revision: 1,
              revisesOrderId: null,
              status: "DRAFT",
            },
          });
          await tx.purchaseOrderLine.createMany({
            data: resolved.map((r, index) => ({
              tenantId: c.tenantId,
              legalEntityId: s.legalEntityId,
              activityId: s.activityId,
              createdById: c.userId,
              orderId: order.id,
              lineNo: index + 1,
              supplierMaterialId: r.supplierMaterialId,
              offerVersionId: r.offerVersionId,
              variantId: r.variantId,
              orderedQty: r.orderedQty,
              purchaseUnit: r.purchaseUnit,
              orderedBaseQty: r.orderedBaseQty,
              baseUnit: r.baseUnit,
              conversionSnapshot: r.conversionSnapshot,
              priceSnapshot: r.priceSnapshot,
              expectedDate: r.expectedDate,
            })),
          });
          await audit(tx, c, s, "PURCHASE_ORDER_CREATED", order.id, {
            lineCount: resolved.length,
          });
          return { id: order.id };
        }
        if (id && path.length === 2 && method === "GET") {
          const row = await orderFor(tx, c, s, id);
          return orderDto(tx, c, row, true);
        }
        if (id && path.length === 2 && method === "PATCH") {
          const row = await orderFor(tx, c, s, id, true);
          if (row.status === "APPROVED")
            throw new AccessError(409, "ORDER_ALREADY_APPROVED");
          if (row.status !== "DRAFT")
            throw new AccessError(409, "ORDER_NOT_MODIFIABLE");
          const body = C.purchaseOrderEdit.parse(input);
          if (
            body.lines.some(
              (l) => !("preserveLineId" in l) && !l.offerVersionId,
            )
          )
            authorize(c, "purchases.costView", row);
          authorize(c, "purchases.edit", row);
          const rateRef: { rate: RateSnapshot | null | undefined } = {
            rate: undefined,
          };
          const resolved: Awaited<ReturnType<typeof resolveLine>>[] = [];
          const preserved = new Set<string>();
          for (const line of body.lines) {
            if ("preserveLineId" in line) {
              if (preserved.has(line.preserveLineId))
                throw new AccessError(400, "INVALID_INPUT");
              preserved.add(line.preserveLineId);
              const old = await tx.purchaseOrderLine.findFirst({
                where: { ...where, orderId: id, id: line.preserveLineId },
              });
              if (!old) throw new AccessError(404, "PURCHASE_LINE_NOT_FOUND");
              resolved.push({
                ...old,
                orderedQty: old.orderedQty.toString(),
                orderedBaseQty: old.orderedBaseQty.toString(),
                expectedDate: line.expectedDate
                  ? new Date(line.expectedDate)
                  : null,
                conversionSnapshot: json(old.conversionSnapshot),
                priceSnapshot: json(old.priceSnapshot),
              });
            } else
              resolved.push(await resolveLine(tx, c, where, line, rateRef));
          }
          const changed = await tx.purchaseOrder.updateMany({
            where: { ...where, id, version: body.version, status: "DRAFT" },
            data: { version: { increment: 1 } },
          });
          if (changed.count !== 1)
            throw new AccessError(409, "VERSION_CONFLICT");
          // Draft lines are fully replaced; nothing is edited in place.
          await tx.purchaseOrderLine.deleteMany({
            where: { ...where, orderId: id },
          });
          await tx.purchaseOrderLine.createMany({
            data: resolved.map((r, index) => ({
              tenantId: c.tenantId,
              legalEntityId: s.legalEntityId,
              activityId: row.activityId,
              createdById: row.createdById,
              orderId: id,
              lineNo: index + 1,
              supplierMaterialId: r.supplierMaterialId,
              offerVersionId: r.offerVersionId,
              variantId: r.variantId,
              orderedQty: r.orderedQty,
              purchaseUnit: r.purchaseUnit,
              orderedBaseQty: r.orderedBaseQty,
              baseUnit: r.baseUnit,
              conversionSnapshot: r.conversionSnapshot,
              priceSnapshot: r.priceSnapshot,
              expectedDate: r.expectedDate,
            })),
          });
          await audit(tx, c, s, "PURCHASE_ORDER_UPDATED", id, {
            lineCount: resolved.length,
          });
          return { id, version: body.version + 1 };
        }
        if (id && sub === "approve" && path.length === 3 && method === "POST") {
          try {
            await requireMfa(headers, true, source);
          } catch (e) {
            throw new AccessError(
              403,
              e instanceof Error && e.message === "STEP_UP_REQUIRED"
                ? "STEP_UP_REQUIRED"
                : "MFA_REQUIRED",
            );
          }
          const row = await orderFor(tx, c, s, id, true);
          if (row.status === "APPROVED")
            throw new AccessError(409, "ORDER_ALREADY_APPROVED");
          if (row.status !== "DRAFT")
            throw new AccessError(409, "ORDER_NOT_MODIFIABLE");
          const body = C.purchaseAction.parse(input);
          authorize(c, "purchases.approve", row);
          if (
            !(await tx.purchaseOrderLine.count({
              where: { ...where, orderId: id },
            }))
          )
            throw new AccessError(409, "ORDER_EMPTY");
          const changed = await tx.purchaseOrder.updateMany({
            where: { ...where, id, version: body.version, status: "DRAFT" },
            data: {
              status: "APPROVED",
              approvedAt: new Date(),
              approvedById: c.userId,
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1)
            throw new AccessError(409, "VERSION_CONFLICT");
          // Approval seals every line snapshot permanently.
          await audit(tx, c, s, "PURCHASE_ORDER_APPROVED", id, {
            lineCount: await tx.purchaseOrderLine.count({
              where: { ...where, orderId: id },
            }),
          });
          return { id, approved: true };
        }
        if (id && sub === "cancel" && path.length === 3 && method === "POST") {
          const row = await orderFor(tx, c, s, id, true);
          if (row.status !== "DRAFT" && row.status !== "APPROVED")
            throw new AccessError(409, "ORDER_NOT_MODIFIABLE");
          const body = C.purchaseAction.parse(input);
          authorize(c, "purchases.cancel", row);
          const changed = await tx.purchaseOrder.updateMany({
            where: { ...where, id, version: body.version },
            data: { status: "CANCELLED", version: { increment: 1 } },
          });
          if (changed.count !== 1)
            throw new AccessError(409, "VERSION_CONFLICT");
          await audit(tx, c, s, "PURCHASE_ORDER_CANCELLED", id);
          return { id, cancelled: true };
        }
        throw new AccessError(404, "NOT_FOUND");
      },
      db,
      s.legalEntityId,
    );
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      if (method === "POST" && path.length === 1 && attempt < 20)
        return purchaseRequest(
          headers,
          path,
          method,
          input,
          query,
          db,
          source,
          attempt + 1,
        );
      throw new AccessError(409, "PURCHASE_ORDER_CONFLICT");
    }
    throw e;
  }
}
