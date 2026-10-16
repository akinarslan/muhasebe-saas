import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { decide } from "@/lib/auth/policy";
import { database } from "@/server/db/client";
import { identity } from "@/server/auth/core";
import {
  contextFor,
  scoped,
  authorize,
  requireStepUp,
  AccessError,
} from "@/server/authorization/context";
import { auditData } from "@/server/authorization/users";
const uuid = z.uuid();
export async function customers(
  headers: Headers,
  entityId: string,
  db = database(),
  source = identity(),
) {
  uuid.parse(entityId);
  const c = await contextFor(headers, db, source);
  if (
    !c.grants.some(
      (g) =>
        g.permissionId === "customers.view" &&
        g.effect === "ALLOW" &&
        (!g.scope.legalEntityId || g.scope.legalEntityId === entityId),
    )
  )
    throw new AccessError(403, "FORBIDDEN");
  return scoped(
    c,
    (tx) =>
      tx.customer.findMany({
        where: { tenantId: c.tenantId, legalEntityId: entityId },
        select: {
          id: true,
          name: true,
          email: true,
          activityId: true,
          createdById: true,
          version: true,
        },
        orderBy: { name: "asc" },
        take: 200,
      }),
    db,
    entityId,
  );
}
export async function createCustomer(
  headers: Headers,
  input: unknown,
  db = database(),
  source = identity(),
) {
  const data = z
    .object({
      legalEntityId: uuid,
      activityId: uuid.nullable(),
      name: z.string().trim().min(2).max(200),
      email: z.email().optional(),
    })
    .strict()
    .parse(input);
  const c = await contextFor(headers, db, source);
  const resource = {
    tenantId: c.tenantId,
    legalEntityId: data.legalEntityId,
    activityId: data.activityId,
    createdById: c.userId,
  };
  authorize(c, "customers.create", resource);
  return scoped(
    c,
    async (tx) => {
      if (
        !(await tx.legalEntity.findUnique({
          where: { id: data.legalEntityId },
        }))
      )
        throw new AccessError(404, "COMPANY_NOT_FOUND");
      if (
        data.activityId &&
        !(await tx.activity.findFirst({
          where: {
            id: data.activityId,
            legalEntityId: data.legalEntityId,
            tenantId: c.tenantId,
          },
        }))
      )
        throw new AccessError(403, "ACTIVITY_REJECTED");
      const row = await tx.customer.create({
        data: {
          ...data,
          tenantId: c.tenantId,
          createdById: c.userId,
          sourceId: `cloud:${randomUUID()}`,
        },
        select: { id: true, name: true, email: true, version: true },
      });
      await tx.auditEvent.create({
        data: auditData(
          c,
          "CUSTOMER_CREATED",
          row.id,
          { version: row.version },
          data.legalEntityId,
        ),
      });
      return row;
    },
    db,
    data.legalEntityId,
  );
}
export async function materials(
  headers: Headers,
  entityId: string,
  db = database(),
  source = identity(),
) {
  uuid.parse(entityId);
  const c = await contextFor(headers, db, source);
  if (
    !c.grants.some(
      (g) =>
        g.permissionId === "materials.view" &&
        g.effect === "ALLOW" &&
        (!g.scope.legalEntityId || g.scope.legalEntityId === entityId),
    )
  )
    throw new AccessError(403, "FORBIDDEN");
  return scoped(
    c,
    async (tx) => {
      const rows = await tx.material.findMany({
        where: { tenantId: c.tenantId, legalEntityId: entityId },
        select: {
          id: true,
          name: true,
          unit: true,
          roll: true,
          tenantId: true,
          legalEntityId: true,
          activityId: true,
          createdById: true,
        },
        take: 200,
      });
      const result = [];
      for (const row of rows) {
        const cost = decide(c.userId, "materials.costView", row, c.grants);
        // Positive projection prevents leaking costs through nested data, history,
        // supplier totals, snapshots, or derived fields added to the model later.
        const variants = await tx.materialVariant.findMany({
          where: { materialId: row.id },
          select: {
            id: true,
            name: true,
            widthCm: true,
            lengthCm: true,
            inStock: true,
            ...(cost ? { usdCost: true } : {}),
          },
        });
        result.push({
          id: row.id,
          name: row.name,
          unit: row.unit,
          roll: row.roll,
          variants,
        });
      }
      return result;
    },
    db,
    entityId,
  );
}
export async function changeCost(
  headers: Headers,
  variantId: string,
  input: unknown,
  db = database(),
  source = identity(),
) {
  uuid.parse(variantId);
  const data = z
    .object({
      legalEntityId: uuid,
      usdCost: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/),
    })
    .strict()
    .parse(input);
  const c = await contextFor(headers, db, source);
  return scoped(
    c,
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MaterialVariant" WHERE id=${variantId}::uuid FOR UPDATE`;
      const variant = await tx.materialVariant.findUnique({
        where: { id: variantId },
        include: { material: true },
      });
      if (!variant) throw new AccessError(404, "NOT_FOUND");
      authorize(c, "materials.costEdit", variant.material);
      const cost = new Prisma.Decimal(data.usdCost);
      await tx.materialPriceHistory.create({
        data: {
          tenantId: c.tenantId,
          legalEntityId: data.legalEntityId,
          variantId,
          actorId: c.userId,
          previousUsd: variant.usdCost,
          nextUsd: cost,
        },
      });
      await tx.materialVariant.update({
        where: { id: variantId },
        data: { usdCost: cost },
      });
      // Audit readers without cost access cannot infer amounts from the audit API.
      await tx.auditEvent.create({
        data: auditData(
          c,
          "USD_COST_CHANGED",
          variantId,
          { changed: true, historyRecorded: true },
          data.legalEntityId,
        ),
      });
      return { updated: true };
    },
    db,
    data.legalEntityId,
  );
}
export async function manualRate(
  headers: Headers,
  input: unknown,
  db = database(),
  source = identity(),
) {
  const data = z
    .object({
      usdTry: z
        .string()
        .regex(/^\d{1,6}(\.\d{1,6})?$/)
        .refine((s) => new Prisma.Decimal(s).gt(0)),
      reason: z.string().trim().min(5).max(500),
    })
    .strict()
    .parse(input);
  const c = await contextFor(headers, db, source);
  authorize(c, "exchange.manual", { tenantId: c.tenantId });
  await requireStepUp(headers, source);
  return scoped(
    c,
    async (tx) => {
      const rate = await tx.tenantExchangeRate.create({
        data: {
          tenantId: c.tenantId,
          actorId: c.userId,
          usdTry: data.usdTry,
          reason: data.reason,
          publishedAt: new Date(new Date().toISOString().slice(0, 10)),
        },
      });
      await tx.auditEvent.create({
        data: auditData(c, "MANUAL_RATE_CREATED", rate.id, {
          usdTry: rate.usdTry.toString(),
          source: "manual",
        }),
      });
      return {
        id: rate.id,
        usdTry: rate.usdTry.toString(),
        source: "manual",
        publishedAt: rate.publishedAt,
        createdAt: rate.createdAt,
      };
    },
    db,
  );
}
