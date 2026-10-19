import "server-only";
import Decimal from "decimal.js";
import { supplierBusinessDate } from "@/lib/cloud/supplier-date";
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
import { scopeSchema } from "@/lib/cloud/contracts";
import * as C from "@/lib/cloud/supplier-contracts";
import {
  compareSupplierOffers,
  normalizeSupplierPrice,
  unitConversion,
  supplierMinimumBaseQuantity,
} from "@/lib/cloud/supplier-pricing";
import { fetchTcmb } from "@/lib/tcmb";
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

const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const day = (d: Date) => d.toISOString().slice(0, 10);
function conversion(
  purchaseUnit: string,
  variant: {
    widthCm: Prisma.Decimal;
    lengthCm: Prisma.Decimal | null;
    material: { unit: string; roll: boolean };
  },
) {
  try {
    return unitConversion(purchaseUnit, variant.material.unit, {
      roll: variant.material.roll,
      widthCm: variant.widthCm.toString(),
      lengthCm: variant.lengthCm?.toString() ?? null,
    });
  } catch {
    throw new AccessError(422, "UNIT_CONVERSION_REJECTED");
  }
}
async function variantFor(tx: Tx, c: Context, s: Scope, id: string) {
  const v = await tx.materialVariant.findFirst({
    where: { id, tenantId: c.tenantId, legalEntityId: s.legalEntityId },
    include: { material: true },
  });
  if (!v || (v.material.activityId && v.material.activityId !== s.activityId))
    throw new AccessError(404, "MATERIAL_NOT_FOUND");
  authorize(c, "materials.view", v.material);
  return v;
}
function supplierDto(row: Prisma.SupplierGetPayload<object>) {
  return {
    id: row.id,
    activityId: row.activityId,
    version: row.version,
    name: row.name,
    tradeName: row.tradeName,
    phone: row.phone,
    email: row.email,
    taxOffice: row.taxOffice,
    taxId: row.taxId,
    city: row.city,
    district: row.district,
    address: row.address,
    contact: row.contact,
    defaultCurrency: row.defaultCurrency,
    leadTimeDays: row.leadTimeDays,
    notes: row.notes,
    active: row.active,
  };
}
async function supplierFor(tx: Tx, c: Context, s: Scope, id: string) {
  const row = await tx.supplier.findFirst({
    where: {
      id,
      tenantId: c.tenantId,
      legalEntityId: s.legalEntityId,
      ...(s.activityId
        ? { OR: [{ activityId: null }, { activityId: s.activityId }] }
        : {}),
    },
  });
  if (!row) throw new AccessError(404, "SUPPLIER_NOT_FOUND");
  authorize(c, "suppliers.view", row);
  return row;
}
async function linkFor(tx: Tx, c: Context, s: Scope, id: string) {
  const row = await tx.supplierMaterial.findFirst({
    where: { id, tenantId: c.tenantId, legalEntityId: s.legalEntityId },
  });
  if (!row) throw new AccessError(404, "SUPPLIER_MATERIAL_NOT_FOUND");
  const supplier = await supplierFor(tx, c, s, row.supplierId);
  const variant = await variantFor(
    tx,
    c,
    { ...s, activityId: row.activityId },
    row.variantId,
  );
  return { row, supplier, variant };
}
export async function supplierRequest(
  headers: Headers,
  path: string[],
  method: string,
  input: unknown,
  query: URLSearchParams,
  db = database(),
  source = identity(),
  rateProvider = fetchTcmb,
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
  if (id) z.uuid().parse(id);
  try {
    return await scoped(
      c,
      async (tx) => {
        await validateScope(tx, c, s);
        const where = { tenantId: c.tenantId, legalEntityId: s.legalEntityId };
        if (kind === "suppliers" && path.length === 1 && method === "GET") {
          // Row-specific OWN/ACTIVITY/DENY is enforced again by FORCE RLS.
          const active = query.get("active"),
            q = query.get("q")?.trim().slice(0, 200) ?? "";
          const rows = await tx.supplier.findMany({
            where: {
              ...where,
              ...(s.activityId
                ? { OR: [{ activityId: null }, { activityId: s.activityId }] }
                : {}),
              ...(active === "true" || active === "false"
                ? { active: active === "true" }
                : {}),
              ...(q
                ? {
                    AND: [
                      {
                        OR: [
                          { name: { contains: q, mode: "insensitive" } },
                          { tradeName: { contains: q, mode: "insensitive" } },
                          { taxId: { contains: q } },
                        ],
                      },
                    ],
                  }
                : {}),
            },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            take: 501,
          });
          if (rows.length > 500)
            throw new AccessError(422, "RESULT_LIMIT_NARROW_FILTER");
          return rows
            .filter((r) => can(c, "suppliers.view", r))
            .map(supplierDto);
        }
        if (kind === "suppliers" && path.length === 1 && method === "POST") {
          const body = C.supplierCreate.parse(input);
          authorize(c, "suppliers.create", resource(c, body));
          authorize(c, "suppliers.view", resource(c, body));
          const digest = hash(body);
          await lock(
            tx,
            `${c.tenantId}:${s.legalEntityId}:supplier:${body.idempotencyKey}`,
          );
          const old = replay(
            await tx.supplier.findFirst({
              where: { ...where, idempotencyKey: body.idempotencyKey },
            }),
            digest,
          );
          if (old) {
            authorize(c, "suppliers.view", old);
            return { id: old.id };
          }
          const row = await tx.supplier.create({
            data: {
              ...body,
              tenantId: c.tenantId,
              createdById: c.userId,
              payloadHash: digest,
            },
          });
          await audit(tx, c, s, "SUPPLIER_CREATED", row.id);
          return { id: row.id };
        }
        if (kind === "suppliers" && id && path.length === 2) {
          const row = await supplierFor(tx, c, s, id);
          if (method === "GET") return supplierDto(row);
          if (method === "PATCH") {
            const body = C.supplierEdit.parse(input);
            if (body.activityId !== row.activityId)
              throw new AccessError(422, "SCOPE_IMMUTABLE");
            authorize(c, "suppliers.edit", row);
            const {
              version,
              legalEntityId: unused,
              activityId: ignored,
              ...fields
            } = body;
            void unused;
            void ignored;
            const changed = await tx.supplier.updateMany({
              where: { ...where, id, version },
              data: { ...fields, version: { increment: 1 } },
            });
            if (changed.count !== 1)
              throw new AccessError(409, "VERSION_CONFLICT");
            await audit(
              tx,
              c,
              s,
              fields.active ? "SUPPLIER_UPDATED" : "SUPPLIER_DEACTIVATED",
              id,
            );
            return { id };
          }
        }
        if (
          kind === "suppliers" &&
          id &&
          sub === "materials" &&
          path.length === 3
        ) {
          const supplier = await supplierFor(tx, c, s, id);
          if (method === "GET") {
            const links = await tx.supplierMaterial.findMany({
              where: { ...where, supplierId: id },
              orderBy: { createdAt: "asc" },
              take: 501,
            });
            if (links.length > 500)
              throw new AccessError(422, "RESULT_LIMIT_NARROW_FILTER");
            const result = [];
            for (const l of links) {
              const v = await variantFor(
                tx,
                c,
                { ...s, activityId: l.activityId },
                l.variantId,
              );
              result.push({
                id: l.id,
                variantId: v.id,
                variantName: v.name,
                materialName: v.material.name,
                baseUnit: v.material.unit,
                supplierSku: l.supplierSku,
                purchaseUnit: l.purchaseUnit,
                minOrderQty: l.minOrderQty.toString(),
                leadTimeDays: l.leadTimeDays,
                active: l.active,
                version: l.version,
              });
            }
            return result;
          }
          if (method === "POST") {
            const body = C.supplierLinkCreate.parse(input);
            authorize(c, "supplierMaterials.manage", supplier);
            if (!supplier.active || body.activityId !== supplier.activityId)
              throw new AccessError(422, "SUPPLIER_UNAVAILABLE");
            const v = await variantFor(tx, c, s, body.variantId);
            if (!v.active || !v.material.active)
              throw new AccessError(422, "MATERIAL_UNAVAILABLE");
            conversion(body.purchaseUnit, v);
            const digest = hash({ ...body, supplierId: id });
            await lock(
              tx,
              `${c.tenantId}:${s.legalEntityId}:supplier-link:${body.idempotencyKey}`,
            );
            const old = replay(
              await tx.supplierMaterial.findFirst({
                where: { ...where, idempotencyKey: body.idempotencyKey },
              }),
              digest,
            );
            if (old) return { id: old.id };
            if (
              await tx.supplierMaterial.findFirst({
                where: { ...where, supplierId: id, variantId: body.variantId },
              })
            )
              throw new AccessError(409, "SUPPLIER_VARIANT_ALREADY_LINKED");
            const row = await tx.supplierMaterial.create({
              data: {
                ...body,
                ...where,
                supplierId: id,
                createdById: supplier.createdById,
                payloadHash: digest,
              },
            });
            await audit(tx, c, s, "SUPPLIER_MATERIAL_LINKED", row.id);
            return { id: row.id };
          }
        }
        if (
          kind === "supplier-materials" &&
          id &&
          path.length === 2 &&
          method === "PATCH"
        ) {
          const { row, supplier, variant } = await linkFor(tx, c, s, id);
          const body = C.supplierLinkEdit.parse(input);
          authorize(c, "supplierMaterials.manage", supplier);
          if (body.activityId !== row.activityId)
            throw new AccessError(422, "SCOPE_IMMUTABLE");
          conversion(body.purchaseUnit, variant);
          const {
            version,
            legalEntityId: unused,
            activityId: ignored,
            ...fields
          } = body;
          void unused;
          void ignored;
          const result = await tx.supplierMaterial.updateMany({
            where: { ...where, id, version },
            data: { ...fields, version: { increment: 1 } },
          });
          if (result.count !== 1)
            throw new AccessError(409, "VERSION_CONFLICT");
          await audit(tx, c, s, "SUPPLIER_MATERIAL_UPDATED", id);
          return { id };
        }
        if (
          kind === "supplier-offers" &&
          path.length === 1 &&
          method === "POST"
        ) {
          const body = C.supplierOfferCreate.parse(input);
          const {
            row: link,
            supplier,
            variant,
          } = await linkFor(tx, c, s, body.supplierMaterialId);
          authorize(c, "supplierOffers.view", supplier);
          authorize(c, "supplierOffers.create", supplier);
          authorize(c, "supplierOffers.costView", supplier);
          authorize(c, "materials.costView", variant.material);
          if (
            !supplier.active ||
            !link.active ||
            !variant.active ||
            !variant.material.active
          )
            throw new AccessError(422, "SUPPLIER_UNAVAILABLE");
          if (
            body.activityId !== link.activityId ||
            (body.maxQty && new Decimal(body.maxQty).lte(body.minQty)) ||
            body.offeredOn > supplierBusinessDate()
          )
            throw new AccessError(422, "OFFER_RANGE_REJECTED");
          const digest = hash(body);
          // Serialize all offers of a link, including concurrent revision allocation and retries.
          await lock(
            tx,
            `${c.tenantId}:${s.legalEntityId}:supplier-offer:${link.id}`,
          );
          const old = replay(
            await tx.supplierOfferVersion.findFirst({
              where: { ...where, idempotencyKey: body.idempotencyKey },
            }),
            digest,
          );
          if (old) return { id: old.id };
          let minOrderBaseQty: string;
          try {
            minOrderBaseQty = supplierMinimumBaseQuantity(
              link.minOrderQty.toString(),
              conversion(link.purchaseUnit, variant).factor,
            );
          } catch {
            throw new AccessError(422, "UNIT_CONVERSION_REJECTED");
          }
          const conv = {
            ...conversion(body.purchaseUnit, variant),
            minOrderBaseQty,
            leadTimeDays: link.leadTimeDays,
            supplierSku: link.supplierSku,
          };
          const rate =
            body.originalCurrency === "TRY"
              ? await rateProvider().catch(() => null)
              : null;
          const normalized = normalizeSupplierPrice(
            body.originalUnitPrice,
            body.originalCurrency,
            conv.factor,
            body.offeredOn,
            rate,
          );
          if (
            normalized.normalizedUsdUnitPrice &&
            (new Decimal(normalized.normalizedUsdUnitPrice).lte(0) ||
              new Decimal(normalized.normalizedUsdUnitPrice).gte(
                "1000000000000",
              ))
          )
            throw new AccessError(422, "AMOUNT_OUT_OF_RANGE");
          const last = await tx.supplierOfferVersion.aggregate({
            where: { ...where, supplierMaterialId: link.id },
            _max: { revision: true },
          });
          const {
            legalEntityId: unused,
            activityId: ignored,
            ...fields
          } = body;
          void unused;
          void ignored;
          const tierKey = `${body.purchaseUnit}:${new Decimal(body.minQty).toFixed()}:${body.maxQty ? new Decimal(body.maxQty).toFixed() : "*"}`;
          const row = await tx.supplierOfferVersion.create({
            data: {
              ...fields,
              ...where,
              activityId: link.activityId,
              createdById: link.createdById,
              recordedById: c.userId,
              payloadHash: digest,
              revision: (last._max.revision ?? 0) + 1,
              tierKey,
              offeredOn: new Date(body.offeredOn),
              validFrom: new Date(body.validFrom),
              validUntil: body.validUntil ? new Date(body.validUntil) : null,
              ...normalized,
              fxSnapshot: json(normalized.fxSnapshot),
              conversionSnapshot: json(conv),
            },
          });
          await audit(tx, c, s, "SUPPLIER_OFFER_VERSION_CREATED", row.id, {
            revision: row.revision,
            priceChanged: true,
          });
          return { id: row.id };
        }
        if (
          (kind === "supplier-offers" || kind === "supplier-comparison") &&
          path.length === 1 &&
          method === "GET"
        ) {
          const comparing = kind === "supplier-comparison",
            historical = query.get("history") === "1";
          const variantId = comparing
            ? z.uuid().parse(query.get("variant"))
            : null;
          const linkId = comparing ? null : z.uuid().parse(query.get("link"));
          const links = await tx.supplierMaterial.findMany({
            where: {
              ...where,
              ...(variantId ? { variantId } : { id: linkId! }),
              ...(s.activityId
                ? { OR: [{ activityId: null }, { activityId: s.activityId }] }
                : {}),
            },
            include: { supplier: true },
            take: 501,
          });
          if (links.length > 500)
            throw new AccessError(422, "RESULT_LIMIT_NARROW_FILTER");
          const sharedVariant = variantId
            ? await variantFor(tx, c, s, variantId)
            : null;
          const allOffers = await tx.supplierOfferVersion.findMany({
            where: {
              ...where,
              supplierMaterialId: { in: links.map((l) => l.id) },
            },
            orderBy: { revision: "desc" },
            take: 1001,
          });
          if (allOffers.length > 1000)
            throw new AccessError(422, "RESULT_LIMIT_NARROW_FILTER");
          const result = [];
          let baseUnit = sharedVariant?.material.unit ?? "";
          for (const link of links) {
            const supplier = link.supplier;
            authorize(c, "suppliers.view", supplier);
            authorize(c, "supplierOffers.view", supplier);
            if (historical) authorize(c, "supplierOffers.history", supplier);
            const v =
              sharedVariant ??
              (await variantFor(
                tx,
                c,
                { ...s, activityId: link.activityId },
                link.variantId,
              ));
            baseUnit = v.material.unit;
            const cost =
              can(c, "supplierOffers.costView", supplier) &&
              can(c, "materials.costView", v.material);
            if (comparing && !cost)
              throw new AccessError(403, "COST_VIEW_REQUIRED");
            const offers = allOffers.filter(
              (o) => o.supplierMaterialId === link.id,
            );
            const seen = new Set<string>();
            for (const r of offers) {
              if (!historical && !comparing && seen.has(r.tierKey)) continue;
              seen.add(r.tierKey);
              const frozen = r.conversionSnapshot as Prisma.JsonObject;
              const value = {
                id: r.id,
                supplierMaterialId: link.id,
                supplierId: supplier.id,
                supplierName: supplier.name,
                materialName: v.material.name,
                variantName: v.name,
                revision: r.revision,
                tierKey: r.tierKey,
                originalCurrency: r.originalCurrency,
                purchaseUnit: r.purchaseUnit,
                validFrom: day(r.validFrom),
                validUntil: r.validUntil ? day(r.validUntil) : null,
                offeredOn: day(r.offeredOn),
                recordedById: r.recordedById,
                leadTimeDays:
                  typeof frozen.leadTimeDays === "number"
                    ? frozen.leadTimeDays
                    : link.leadTimeDays,
                active:
                  supplier.active &&
                  link.active &&
                  v.active &&
                  v.material.active,
              };
              result.push({
                ...value,
                ...(cost
                  ? {
                      originalUnitPrice: r.originalUnitPrice.toString(),
                      normalizedUsdUnitPrice:
                        r.normalizedUsdUnitPrice?.toString() ?? null,
                      fxSnapshot: r.fxSnapshot,
                      conversionSnapshot: r.conversionSnapshot as {
                        factor: string;
                        baseUnit: string;
                      },
                      minQty: r.minQty.toString(),
                      maxQty: r.maxQty?.toString() ?? null,
                      supplierReference: r.supplierReference,
                      notes: r.notes,
                    }
                  : {}),
              });
            }
          }
          if (comparing) {
            const asOf = z.iso
              .date()
              .parse(query.get("asOf") || supplierBusinessDate());
            if (asOf > supplierBusinessDate())
              throw new AccessError(422, "COMPARISON_DATE_REJECTED");
            const quantity = C.supplierDecimal.parse(
              query.get("quantity") || "1",
            );
            if (new Decimal(quantity).lte(0))
              throw new AccessError(422, "QUANTITY_REJECTED");
            const compared = compareSupplierOffers(
              result,
              quantity,
              baseUnit,
              asOf,
            );
            // History permission is not implied by comparison. Return one effective revision per tier.
            const effective = compared.filter(
              (r) => r.comparisonReason !== "SUPERSEDED",
            );
            return {
              baseUnit,
              quantity,
              asOf,
              rows: effective,
              recommendationId: effective.find((r) => r.comparable)?.id ?? null,
            };
          }
          return result;
        }
        throw new AccessError(404, "NOT_FOUND");
      },
      db,
      s.legalEntityId,
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new AccessError(409, "SUPPLIER_CONFLICT");
    throw e;
  }
}
