import "server-only";
import { z } from "zod";
import { database } from "@/server/db/client";
import { identity } from "@/server/auth/core";
import { requireMfa } from "@/server/auth/mfa";
import {
  contextFor,
  scoped,
  authorize,
  AccessError,
} from "@/server/authorization/context";
import { scopeSchema } from "@/lib/cloud/contracts";
import * as C from "@/lib/cloud/receipt-contracts";
import { can, resource, validateScope } from "./catalog";
function snapshotText(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : "";
}
export async function inventoryRequest(
  headers: Headers,
  path: string[],
  method: string,
  input: unknown,
  query: URLSearchParams,
  db = database(),
  source = identity(),
) {
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
  if (id && kind === "goods-receipts") z.uuid().parse(id);
  if (method !== "GET" && ["post", "reverse"].includes(sub)) {
    try {
      await requireMfa(headers, true, source);
    } catch {
      throw new AccessError(403, "STEP_UP_REQUIRED");
    }
  }
  try {
    return await scoped(
      c,
      async (tx) => {
        // Runtime limits are local to this transaction, below Prisma's unchanged 15s limit.
        await tx.$queryRaw`SELECT set_config('lock_timeout','3s',true),set_config('statement_timeout','10s',true)`;
        await validateScope(tx, c, s);
        const where = {
          tenantId: c.tenantId,
          legalEntityId: s.legalEntityId,
          ...(s.activityId
            ? { OR: [{ activityId: null }, { activityId: s.activityId }] }
            : {}),
        };
        if (method === "GET") {
          if (kind === "goods-receipts" && id && sub === "outcome") {
            const action = z
              .enum(["post", "reverse"])
              .parse(query.get("action"));
            const receipt = await tx.goodsReceipt.findFirst({
              where: { ...where, id },
            });
            if (!receipt) throw new AccessError(404, "NOT_FOUND");
            authorize(c, "receipts.view", receipt);
            authorize(
              c,
              action === "post" ? "receipts.post" : "receipts.reverse",
              receipt,
            );
            const rows = await tx.$queryRaw<
              { state: "SUCCEEDED" | "NOT_COMMITTED" }[]
            >`SELECT public.v43b_receipt_outcome(${id}::uuid,${action}) state`;
            return { id, action, state: rows[0].state };
          }
          if (kind === "goods-receipts") {
            authorize(c, "receipts.view", resource(c, s));
            const rows = await tx.goodsReceipt.findMany({
              where: { ...where, ...(id ? { id } : {}) },
              orderBy: { createdAt: "desc" },
              take: 201,
            });
            if (rows.length > 200)
              throw new AccessError(422, "RESULT_LIMIT_NARROW_FILTER");
            const result = [];
            for (const r of rows) {
              if (!can(c, "receipts.view", r)) continue;
              const lines = await tx.goodsReceiptLine.findMany({
                where: { receiptId: r.id },
                orderBy: { lineNo: "asc" },
                select: {
                  id: true,
                  orderLineId: true,
                  lineNo: true,
                  receivedQty: true,
                  rejectedQty: true,
                  rejectionReason: true,
                },
              });
              result.push({
                id: r.id,
                orderId: r.orderId,
                locationId: r.locationId,
                activityId: r.activityId,
                status: r.status,
                version: r.version,
                receivedAt: r.receivedAt.toISOString().slice(0, 10),
                sourceRef: r.sourceRef,
                postedAt: r.postedAt?.toISOString() ?? null,
                lines: lines.map((l) => ({
                  ...l,
                  receivedQty: l.receivedQty.toFixed(),
                  rejectedQty: l.rejectedQty.toFixed(),
                })),
              });
            }
            if (id) {
              if (!result[0]) throw new AccessError(404, "NOT_FOUND");
              return result[0];
            }
            return result;
          }
          if (kind === "receipt-orders") {
            if (
              !can(c, "receipts.create", resource(c, s)) &&
              !can(c, "receipts.edit", resource(c, s))
            )
              throw new AccessError(403, "FORBIDDEN");
            const orders = await tx.purchaseOrder.findMany({
              where: { ...where, status: "APPROVED" },
              select: {
                id: true,
                businessNo: true,
                tenantId: true,
                legalEntityId: true,
                activityId: true,
                createdById: true,
              },
              take: 200,
            });
            const result = [];
            for (const o of orders) {
              if (!can(c, "purchases.view", o)) continue;
              const lines = await tx.purchaseOrderLine.findMany({
                where: { orderId: o.id },
                select: {
                  id: true,
                  lineNo: true,
                  orderedQty: true,
                  purchaseUnit: true,
                  conversionSnapshot: true,
                  orderedBaseQty: true,
                  baseUnit: true,
                },
              });
              const received = await tx.$queryRaw<
                { orderLineId: string; accepted: string }[]
              >`SELECT * FROM public.v43b_order_received(${o.id}::uuid)`;
              result.push({
                id: o.id,
                businessNo: o.businessNo,
                activityId: o.activityId,
                lines: lines.map((l) => ({
                  id: l.id,
                  lineNo: l.lineNo,
                  purchaseUnit: l.purchaseUnit,
                  baseUnit: l.baseUnit,
                  materialName: snapshotText(
                    l.conversionSnapshot,
                    "materialName",
                  ),
                  variantName: snapshotText(
                    l.conversionSnapshot,
                    "variantName",
                  ),
                  orderedQty: l.orderedQty.toFixed(),
                  orderedBaseQty: l.orderedBaseQty.toFixed(),
                  acceptedQty:
                    received.find((x) => x.orderLineId === l.id)?.accepted ??
                    "0",
                })),
              });
            }
            return result;
          }
          if (kind === "stock" && id === "locations") {
            authorize(c, "stock.view", resource(c, s));
            return tx.stockLocation.findMany({
              where,
              select: {
                id: true,
                code: true,
                name: true,
                activityId: true,
                active: true,
              },
              take: 200,
            });
          }
          if (kind === "stock" && id === "movements") {
            authorize(c, "stock.movementsView", resource(c, s));
            const rows = await tx.stockMovement.findMany({
              where,
              orderBy: { createdAt: "desc" },
              take: 200,
              select: {
                id: true,
                batchId: true,
                lotId: true,
                locationId: true,
                quantityDeltaBase: true,
                baseUnit: true,
                createdAt: true,
              },
            });
            return rows.map((r) => ({
              ...r,
              quantityDeltaBase: r.quantityDeltaBase.toFixed(),
            }));
          }
          if (kind === "stock" && id === "lots") {
            authorize(c, "stock.view", resource(c, s));
            const rows = await tx.stockLot.findMany({
              where,
              orderBy: { createdAt: "desc" },
              take: 200,
            });
            const result = [];
            for (const r of rows) {
              if (!can(c, "stock.view", r)) continue;
              const balances = await tx.stockBalance.findMany({
                where: { lotId: r.id },
                select: { locationId: true, quantityBase: true },
              });
              const frozen =
                r.conversionSnapshot &&
                typeof r.conversionSnapshot === "object" &&
                !Array.isArray(r.conversionSnapshot)
                  ? r.conversionSnapshot
                  : {};
              const sourceVariant = can(c, "receipts.costView", r)
                ? await tx.materialVariant.findFirst({
                    where: { id: r.variantId },
                    select: {
                      material: {
                        select: {
                          tenantId: true,
                          legalEntityId: true,
                          activityId: true,
                          createdById: true,
                        },
                      },
                    },
                  })
                : null;
              const withCost =
                can(c, "receipts.costView", r) &&
                !!sourceVariant &&
                can(c, "materials.costView", sourceVariant.material);
              result.push({
                id: r.id,
                lotCode: r.lotCode,
                materialName:
                  typeof frozen.materialName === "string"
                    ? frozen.materialName
                    : "",
                variantName:
                  typeof frozen.variantName === "string"
                    ? frozen.variantName
                    : "",
                variantId: r.variantId,
                form: r.form,
                baseUnit: r.baseUnit,
                initialBaseQty: r.initialBaseQty.toFixed(),
                widthCm: r.widthCm?.toString() ?? null,
                initialLengthM: r.initialLengthM?.toFixed() ?? null,
                sheetHeightCm: r.sheetHeightCm?.toString() ?? null,
                balances: balances.map((b) => ({
                  locationId: b.locationId,
                  quantityBase: b.quantityBase.toFixed(),
                  areaM2: C.stockArea(
                    b.quantityBase.toFixed(),
                    r.widthCm?.toString() ?? null,
                    r.sheetHeightCm?.toString() ?? null,
                    r.form,
                  ),
                })),
                ...(withCost
                  ? { acquisitionSnapshot: r.acquisitionSnapshot }
                  : {}),
              });
            }
            return result;
          }
          throw new AccessError(404, "NOT_FOUND");
        }
        let op: string, body: Record<string, unknown>;
        if (kind === "stock" && id === "locations" && method === "POST") {
          op = "location";
          body = C.locationCreate.parse(input);
          authorize(c, "stock.locationsManage", resource(c, s));
        } else if (kind === "goods-receipts" && !id && method === "POST") {
          op = "create";
          body = C.receiptCreate.parse(input);
          authorize(c, "receipts.create", resource(c, s));
        } else if (kind === "goods-receipts" && id && method === "PATCH") {
          op = "edit";
          body = { ...C.receiptEdit.parse(input), id };
        } else if (
          kind === "goods-receipts" &&
          id &&
          ["post", "cancel", "reverse"].includes(sub) &&
          method === "POST"
        ) {
          op = sub;
          body = { ...C.receiptAction.parse(input), id };
        } else throw new AccessError(404, "NOT_FOUND");
        const r = await tx.$queryRaw<
          { id: string }[]
        >`SELECT public.v43b_command(${op},${JSON.stringify(body)}::jsonb)::text id`;
        return { id: r[0].id };
      },
      db,
      s.legalEntityId,
    );
  } catch (e) {
    if (e instanceof AccessError) throw e;
    const cause = e as {
      code?: string;
      meta?: {
        driverAdapterError?: {
          cause?: { originalCode?: string; originalMessage?: string };
        };
      };
    };
    const detail = cause.meta?.driverAdapterError?.cause;
    const sqlCode = detail?.originalCode;
    if (sqlCode === "40P01") throw new AccessError(409, "STOCK_DEADLOCK");
    if (sqlCode === "55P03") throw new AccessError(409, "STOCK_LOCK_TIMEOUT");
    if (sqlCode === "57014" || cause.code === "P2028")
      throw new AccessError(503, "STOCK_OUTCOME_UNKNOWN");
    const msg = detail?.originalMessage ?? "";
    const allowed = [
      "OVER_RECEIPT",
      "IDEMPOTENCY_CONFLICT",
      "RECEIPT_STATE_CONFLICT",
      "CANCEL_REJECTED",
      "REVERSAL_REJECTED",
      "ALREADY_REVERSED",
      "QUANTITY_PRECISION",
      "UNSUPPORTED_CONVERSION",
      "GEOMETRY_CHANGED",
      "APPROVED_ORDER_REQUIRED",
      "LOCATION_REQUIRED",
    ];
    const fixed = allowed.find((x) => msg.includes(x));
    if (fixed)
      throw new AccessError(
        fixed.includes("CONVERSION") ||
          fixed.includes("PRECISION") ||
          fixed.includes("GEOMETRY")
          ? 422
          : 409,
        fixed,
      );
    if (detail?.originalCode === "42501")
      throw new AccessError(403, "FORBIDDEN");
    if (
      ["23514", "23503", "23505"].includes(detail?.originalCode ?? "") ||
      cause.code === "P2002"
    )
      throw new AccessError(409, "INVENTORY_CONFLICT");
    throw e;
  }
}
