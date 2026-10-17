import "server-only";
import { createHash } from "node:crypto";
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
import { decide } from "@/lib/auth/policy";
import { normalize } from "@/lib/finance";
import * as C from "@/lib/cloud/contracts";
import { permissions } from "@/lib/auth/catalog";
export type Tx = Prisma.TransactionClient;
export type Scope = { legalEntityId: string; activityId: string | null };
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export const hash = (v: unknown) =>
  createHash("sha256").update(canonical(v)).digest("hex");
export const resource = (c: Context, s: Scope) => ({
  tenantId: c.tenantId,
  ...s,
  createdById: c.userId,
});
export async function validateScope(tx: Tx, c: Context, s: Scope) {
  if (
    !(await tx.legalEntity.findFirst({
      where: { id: s.legalEntityId, tenantId: c.tenantId },
    }))
  )
    throw new AccessError(404, "COMPANY_NOT_FOUND");
  if (
    s.activityId &&
    !(await tx.activity.findFirst({
      where: {
        id: s.activityId,
        tenantId: c.tenantId,
        legalEntityId: s.legalEntityId,
      },
    }))
  )
    throw new AccessError(403, "ACTIVITY_REJECTED");
}
export async function audit(
  tx: Tx,
  c: Context,
  s: Scope,
  action: string,
  targetId: string,
  summary: Prisma.InputJsonValue = { changed: true },
) {
  await tx.auditEvent.create({
    data: {
      tenantId: c.tenantId,
      legalEntityId: s.legalEntityId,
      actorId: c.userId,
      action,
      targetId,
      summary,
    },
  });
}
export async function lock(tx: Tx, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},7310))::text`;
}
export function replay<T extends { payloadHash: string | null; id: string }>(
  row: T | null,
  digest: string,
) {
  if (row && row.payloadHash !== digest)
    throw new AccessError(409, "IDEMPOTENCY_CONFLICT");
  return row;
}
export function can(c: Context, action: string, row: object) {
  return decide(c.userId, action, row as ReturnType<typeof resource>, c.grants);
}
export async function createCustomerRecord(
  tx: Tx,
  c: Context,
  input: z.infer<typeof C.customerCreate>,
) {
  const s = input;
  authorize(c, "customers.create", resource(c, s));
  await validateScope(tx, c, s);
  const sourceId = `cloud:${s.idempotencyKey}`,
    digest = hash(input);
  await lock(tx, `${c.tenantId}:${s.legalEntityId}:customer:${sourceId}`);
  const old = replay(
    await tx.customer.findFirst({
      where: { tenantId: c.tenantId, legalEntityId: s.legalEntityId, sourceId },
    }),
    digest,
  );
  if (old) return old;
  await lock(
    tx,
    `${c.tenantId}:${s.legalEntityId}:customer-name:${normalize(s.name)}`,
  );
  const matches = await tx.customer.findMany({
    where: { tenantId: c.tenantId, legalEntityId: s.legalEntityId },
    select: { name: true, taxId: true },
  });
  if (
    matches.some(
      (m) =>
        normalize(m.name) === normalize(s.name) ||
        (s.taxId && m.taxId === s.taxId),
    )
  )
    throw new AccessError(409, "DUPLICATE_CUSTOMER");
  const { idempotencyKey: unused, ...data } = input;
  void unused;
  const row = await tx.customer.create({
    data: {
      ...data,
      tenantId: c.tenantId,
      createdById: c.userId,
      sourceId,
      payloadHash: digest,
    },
  });
  await audit(tx, c, s, "CUSTOMER_CREATED", row.id, { version: row.version });
  return row;
}
export async function createMaterialRecord(
  tx: Tx,
  c: Context,
  input: z.infer<typeof C.materialCreate>,
) {
  const s = input;
  authorize(c, "materials.create", resource(c, s));
  await validateScope(tx, c, s);
  if (s.variants.some((v) => v.usdCost !== null))
    authorize(c, "materials.costEdit", resource(c, s));
  if ((s.roll && s.unit === "sheet") || (!s.roll && s.unit === "linear_meter"))
    throw new AccessError(400, "INVALID_MATERIAL_UNIT");
  if (
    s.variants.some(
      (v) =>
        (s.roll && v.widthCm <= 0) ||
        (s.unit === "sheet" && (!v.lengthCm || v.widthCm <= 0)),
    )
  )
    throw new AccessError(400, "MATERIAL_DIMENSIONS_REQUIRED");
  const sourceId = `cloud:${s.idempotencyKey}`,
    digest = hash(input);
  await lock(tx, `${c.tenantId}:${s.legalEntityId}:material:${sourceId}`);
  const old = replay(
    await tx.material.findFirst({
      where: { tenantId: c.tenantId, legalEntityId: s.legalEntityId, sourceId },
    }),
    digest,
  );
  if (old) return old;
  const { idempotencyKey: unused, variants, ...data } = input;
  void unused;
  const row = await tx.material.create({
    data: {
      ...data,
      tenantId: c.tenantId,
      createdById: c.userId,
      sourceId,
      payloadHash: digest,
    },
  });
  for (const v of variants) {
    const variant = await tx.materialVariant.create({
      data: {
        tenantId: c.tenantId,
        legalEntityId: s.legalEntityId,
        materialId: row.id,
        name: v.name,
        widthCm: v.widthCm,
        lengthCm: v.lengthCm,
        usdCost: v.usdCost,
        inStock: v.inStock,
        active: v.active,
      },
    });
    if (v.usdCost !== null)
      await tx.materialPriceHistory.create({
        data: {
          tenantId: c.tenantId,
          legalEntityId: s.legalEntityId,
          variantId: variant.id,
          previousUsd: null,
          nextUsd: v.usdCost,
          actorId: c.userId,
        },
      });
  }
  await audit(tx, c, s, "MATERIAL_CREATED", row.id, {
    variantCount: variants.length,
    priceHistoryRecorded: true,
  });
  return row;
}
export async function createProductRecord(
  tx: Tx,
  c: Context,
  input: z.infer<typeof C.productCreate>,
) {
  authorize(c, "products.create", resource(c, input));
  await validateScope(tx, c, input);
  const sourceId = `cloud:${input.idempotencyKey}`,
    digest = hash(input);
  await lock(tx, `${c.tenantId}:${input.legalEntityId}:product:${sourceId}`);
  const old = replay(
    await tx.cloudProduct.findFirst({
      where: {
        tenantId: c.tenantId,
        legalEntityId: input.legalEntityId,
        sourceId,
      },
    }),
    digest,
  );
  if (old) return old;
  const { idempotencyKey: unused, ...data } = input;
  void unused;
  const row = await tx.cloudProduct.create({
    data: {
      ...data,
      tenantId: c.tenantId,
      createdById: c.userId,
      sourceId,
      payloadHash: digest,
    },
  });
  await audit(tx, c, input, "PRODUCT_CREATED", row.id);
  return row;
}
export async function catalogRead(tx: Tx, c: Context, s: Scope) {
  const where = {
    tenantId: c.tenantId,
    legalEntityId: s.legalEntityId,
    ...(s.activityId
      ? { OR: [{ activityId: null }, { activityId: s.activityId }] }
      : {}),
  };
  const materials = await tx.material.findMany({
    where,
    include: { variants: true },
    take: 500,
    orderBy: { name: "asc" },
  });
  const result = materials.map((m) => {
    const costs = can(c, "materials.costView", m);
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      roll: m.roll,
      activityId: m.activityId,
      category: m.category,
      brand: m.brand,
      supplierReference: m.supplierReference,
      sku: m.sku,
      description: m.description,
      vat: m.vat.toString(),
      margins: m.margins,
      active: m.active,
      version: m.version,
      variants: m.variants.map((v) => ({
        id: v.id,
        name: v.name,
        widthCm: v.widthCm.toString(),
        lengthCm: v.lengthCm?.toString() ?? null,
        inStock: v.inStock,
        active: v.active,
        priceVersion: v.priceVersion,
        ...(costs ? { usdCost: v.usdCost?.toString() ?? null } : {}),
      })),
    };
  });
  return result;
}
export async function catalogRequest(
  headers: Headers,
  path: string[],
  method: string,
  input: unknown,
  query: URLSearchParams,
  db = database(),
  source = identity(),
) {
  const c = await contextFor(headers, db, source);
  const scope = C.scopeSchema.parse(
    method === "GET"
      ? {
          legalEntityId: query.get("company"),
          activityId: query.get("activity") || null,
        }
      : input,
  );
  const [kind, id, sub] = path;
  const permissionModule =
    kind === "catalog"
      ? "materials"
      : kind === "activities"
        ? "activities"
        : kind === "history"
          ? "materials"
          : kind;
  return scoped(
    c,
    async (tx) => {
      await validateScope(tx, c, scope);
      if (kind === "capabilities" && method === "GET")
        return {
          actions: permissions
            .filter((p) => can(c, p.id, resource(c, scope)))
            .map((p) => p.id),
        };
      if (kind === "rates" && method === "GET") {
        authorize(c, "exchange.view", resource(c, scope));
        return tx.tenantExchangeRate.findMany({
          where: { tenantId: c.tenantId },
          select: {
            id: true,
            usdTry: true,
            publishedAt: true,
            createdAt: true,
            reason: true,
          },
          take: 50,
          orderBy: { createdAt: "desc" },
        });
      }
      if (kind === "activities" && method === "POST") {
        const data = C.scopeSchema
          .extend({ name: z.string().trim().min(1).max(100) })
          .strict()
          .parse(input);
        authorize(c, "activities.manage", resource(c, scope));
        const row = await tx.activity.create({
          data: {
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
            name: data.name,
          },
        });
        await audit(tx, c, scope, "ACTIVITY_CREATED", row.id);
        return row;
      }
      if (kind === "customers" && method === "POST")
        return {
          id: (await createCustomerRecord(tx, c, C.customerCreate.parse(input)))
            .id,
        };
      if (kind === "materials" && method === "POST")
        return {
          id: (await createMaterialRecord(tx, c, C.materialCreate.parse(input)))
            .id,
        };
      if (kind === "products" && method === "POST")
        return {
          id: (await createProductRecord(tx, c, C.productCreate.parse(input)))
            .id,
        };
      if (kind === "expenses" && method === "POST") {
        const data = C.expenseCreate.parse(input);
        authorize(c, "expenses.create", resource(c, scope));
        authorize(c, "materials.costEdit", resource(c, scope));
        const sourceId = `cloud:${data.idempotencyKey}`,
          digest = hash(data);
        await lock(
          tx,
          `${c.tenantId}:${scope.legalEntityId}:expense:${sourceId}`,
        );
        const old = replay(
          await tx.cloudExpenseType.findFirst({
            where: {
              tenantId: c.tenantId,
              legalEntityId: scope.legalEntityId,
              sourceId,
            },
          }),
          digest,
        );
        if (old) return { id: old.id };
        const { idempotencyKey: unused, ...fields } = data;
        void unused;
        const row = await tx.cloudExpenseType.create({
          data: {
            ...fields,
            tenantId: c.tenantId,
            createdById: c.userId,
            sourceId,
            payloadHash: digest,
          },
        });
        await audit(tx, c, scope, "EXPENSE_TYPE_CREATED", row.id);
        return { id: row.id };
      }
      if (kind === "catalog" && method === "GET")
        return catalogRead(tx, c, scope);
      if (kind === "customers" && method === "GET") {
        const rows = await tx.customer.findMany({
          where: {
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
            ...(scope.activityId
              ? { OR: [{ activityId: null }, { activityId: scope.activityId }] }
              : {}),
          },
          orderBy: { name: "asc" },
          take: 500,
        });
        if (
          !c.grants.some(
            (g) => g.permissionId === "customers.view" && g.effect === "ALLOW",
          )
        )
          throw new AccessError(403, "FORBIDDEN");
        const search = (query.get("q") ?? "").toLocaleLowerCase("tr");
        return rows
          .filter(
            (r) =>
              !search ||
              `${r.name} ${r.taxId} ${r.email}`
                .toLocaleLowerCase("tr")
                .includes(search),
          )
          .map(({ payloadHash: unused, sourceId: unused2, ...r }) => {
            void unused;
            void unused2;
            return r;
          });
      }
      if (kind === "products" && method === "GET") {
        return tx.cloudProduct.findMany({
          where: {
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
            ...(scope.activityId
              ? { OR: [{ activityId: null }, { activityId: scope.activityId }] }
              : {}),
          },
          select: {
            id: true,
            name: true,
            unit: true,
            kind: true,
            category: true,
            activityId: true,
            active: true,
            version: true,
          },
          take: 500,
        });
      }
      if (kind === "expenses" && method === "GET") {
        const rows = await tx.cloudExpenseType.findMany({
          where: { tenantId: c.tenantId, legalEntityId: scope.legalEntityId },
          take: 500,
        });
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          unit: r.unit,
          activityId: r.activityId,
          version: r.version,
          active: r.active,
          ...(can(c, "materials.costView", r)
            ? { usdAmount: r.usdAmount.toString() }
            : {}),
        }));
      }
      if (id) z.uuid().parse(id);
      if (kind === "customers" && id && method === "PATCH") {
        const data = C.customerEdit.parse(input);
        const row = await tx.customer.findUnique({ where: { id } });
        if (!row) throw new AccessError(404, "NOT_FOUND");
        authorize(c, "customers.edit", row);
        authorize(c, "customers.edit", { ...row, activityId: data.activityId });
        await lock(
          tx,
          `customer-name:${c.tenantId}:${scope.legalEntityId}:${normalize(data.name)}`,
        );
        const peers = await tx.customer.findMany({
          where: {
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
            NOT: { id },
          },
        });
        if (
          peers.some(
            (p) =>
              normalize(p.name) === normalize(data.name) ||
              (data.taxId && p.taxId === data.taxId),
          )
        )
          throw new AccessError(409, "CUSTOMER_DUPLICATE");
        const { version, ...fields } = data;
        const changed = await tx.customer.updateMany({
          where: {
            id,
            version,
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
          },
          data: { ...fields, version: { increment: 1 } },
        });
        if (changed.count !== 1) throw new AccessError(409, "VERSION_CONFLICT");
        await audit(tx, c, scope, "CUSTOMER_UPDATED", id, {
          version: version + 1,
        });
        return { id, version: version + 1 };
      }
      if (kind === "materials" && id && method === "PATCH") {
        const data = C.materialEdit.parse(input);
        const row = await tx.material.findUnique({ where: { id } });
        if (!row) throw new AccessError(404, "NOT_FOUND");
        authorize(c, "materials.edit", row);
        authorize(c, "materials.edit", { ...row, activityId: data.activityId });
        if (row.unit !== data.unit)
          throw new AccessError(409, "UNIT_CHANGE_REQUIRES_NEW_MATERIAL");
        const { version, ...fields } = data;
        const changed = await tx.material.updateMany({
          where: {
            id,
            version,
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
          },
          data: { ...fields, version: { increment: 1 } },
        });
        if (changed.count !== 1) throw new AccessError(409, "VERSION_CONFLICT");
        await audit(tx, c, scope, "MATERIAL_UPDATED", id, {
          version: version + 1,
        });
        return { id };
      }
      if (
        kind === "materials" &&
        id &&
        sub === "variants" &&
        method === "POST"
      ) {
        const data = C.scopeSchema
          .extend({ variant: C.variantSchema })
          .strict()
          .parse(input);
        const m = await tx.material.findUnique({ where: { id } });
        if (!m) throw new AccessError(404, "NOT_FOUND");
        authorize(c, "materials.variants", m);
        if (data.variant.usdCost !== null)
          authorize(c, "materials.costEdit", m);
        const v = data.variant;
        if (
          (m.roll && v.widthCm <= 0) ||
          (m.unit === "sheet" && (!v.lengthCm || v.widthCm <= 0))
        )
          throw new AccessError(400, "MATERIAL_DIMENSIONS_REQUIRED");
        const row = await tx.materialVariant.create({
          data: {
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
            materialId: m.id,
            name: v.name,
            widthCm: v.widthCm,
            lengthCm: v.lengthCm,
            inStock: v.inStock,
            active: v.active,
            usdCost: v.usdCost,
          },
        });
        if (v.usdCost !== null)
          await tx.materialPriceHistory.create({
            data: {
              tenantId: c.tenantId,
              legalEntityId: scope.legalEntityId,
              variantId: row.id,
              nextUsd: v.usdCost,
              actorId: c.userId,
            },
          });
        await audit(tx, c, scope, "VARIANT_CREATED", row.id);
        return { id: row.id };
      }
      if (kind === "variants" && id && sub === "cost" && method === "PATCH") {
        const data = C.scopeSchema
          .extend({
            usdCost: C.amount,
            priceVersion: z.number().int().positive(),
          })
          .strict()
          .parse(input);
        await tx.$queryRaw`SELECT id FROM "MaterialVariant" WHERE id=${id}::uuid FOR UPDATE`;
        const v = await tx.materialVariant.findUnique({
          where: { id },
          include: { material: true },
        });
        if (!v) throw new AccessError(404, "NOT_FOUND");
        authorize(c, "materials.costEdit", v.material);
        if (v.priceVersion !== data.priceVersion)
          throw new AccessError(409, "VERSION_CONFLICT");
        await tx.materialPriceHistory.create({
          data: {
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
            variantId: id,
            previousUsd: v.usdCost,
            nextUsd: data.usdCost,
            actorId: c.userId,
          },
        });
        await tx.materialVariant.update({
          where: { id },
          data: { usdCost: data.usdCost, priceVersion: { increment: 1 } },
        });
        await audit(tx, c, scope, "USD_COST_CHANGED", id, {
          historyRecorded: true,
        });
        return { updated: true };
      }
      if (kind === "variants" && id && sub === "history" && method === "GET") {
        const v = await tx.materialVariant.findUnique({
          where: { id },
          include: { material: true },
        });
        if (!v) throw new AccessError(404, "NOT_FOUND");
        authorize(c, "materials.costView", v.material);
        authorize(c, "materials.history", v.material);
        return tx.materialPriceHistory.findMany({
          where: {
            variantId: id,
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
          },
          orderBy: { recordedAt: "desc" },
          take: 200,
        });
      }
      if (kind === "products" && id && method === "PATCH") {
        const data = C.productEdit.parse(input);
        const row = await tx.cloudProduct.findUnique({ where: { id } });
        if (!row) throw new AccessError(404, "NOT_FOUND");
        authorize(c, "products.edit", row);
        const { version, ...fields } = data;
        authorize(c, "products.edit", { ...row, activityId: data.activityId });
        const changed = await tx.cloudProduct.updateMany({
          where: {
            id,
            version,
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
          },
          data: { ...fields, version: { increment: 1 } },
        });
        if (changed.count !== 1) throw new AccessError(409, "VERSION_CONFLICT");
        await audit(tx, c, scope, "PRODUCT_UPDATED", id);
        return { id };
      }
      if (kind === "expenses" && id && method === "PATCH") {
        const data = C.scopeSchema
          .extend({
            name: z.string().min(1).max(200),
            unit: z.string().min(1).max(200),
            usdAmount: C.amount,
            active: z.boolean(),
            version: z.number().int().positive(),
          })
          .strict()
          .parse(input);
        const row = await tx.cloudExpenseType.findUnique({ where: { id } });
        if (!row) throw new AccessError(404, "NOT_FOUND");
        authorize(c, "expenses.edit", row);
        authorize(c, "materials.costEdit", row);
        const { version, ...fields } = data;
        const changed = await tx.cloudExpenseType.updateMany({
          where: {
            id,
            version,
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
          },
          data: { ...fields, version: { increment: 1 } },
        });
        if (changed.count !== 1) throw new AccessError(409, "VERSION_CONFLICT");
        await audit(tx, c, scope, "EXPENSE_TYPE_UPDATED", id);
        return { id };
      }
      void permissionModule;
      throw new AccessError(404, "NOT_FOUND");
    },
    db,
    scope.legalEntityId,
  );
}
