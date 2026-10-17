import "server-only";
import Decimal from "decimal.js";
import {
  historicalSchema,
  validateHistorical,
  createHistorical,
} from "./historical-import";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { database } from "@/server/db/client";
import { identity } from "@/server/auth/core";
import {
  contextFor,
  scoped,
  authorize,
  requireStepUp,
  AccessError,
} from "@/server/authorization/context";
import * as C from "@/lib/cloud/contracts";
import {
  hash,
  resource,
  validateScope,
  lock,
  audit,
  createCustomerRecord,
  createMaterialRecord,
  createProductRecord,
} from "./catalog";

const record = z
  .object({
    sourceId: z.string().min(1).max(200),
    demo: z.boolean().default(false),
    kind: z.enum(["customer", "material", "product", "sale", "quote"]),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();
const previewSchema = C.scopeSchema
  .extend({
    records: z.array(record).min(1).max(200),
    financialRecords: z.number().int().min(0).default(0),
  })
  .strict();
function sourceKey(kind: string, sourceId: string) {
  const hex = createHash("sha256")
    .update(`pusula-import-v1:${kind}:${sourceId}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
export async function importRequest(
  headers: Headers,
  path: string[],
  method: string,
  input: unknown,
  query: URLSearchParams,
  db = database(),
  source = identity(),
) {
  const c = await contextFor(headers, db, source);
  if (method !== "POST") throw new AccessError(404, "NOT_FOUND");
  if (path[1] === "preview") {
    const data = previewSchema.parse(input),
      scope = C.scopeSchema.parse(data);
    authorize(c, "imports.create", resource(c, scope));
    // Preview contains prices; it is never a bypass around normal cost access.
    if (
      data.records.some((r) => ["material", "sale", "quote"].includes(r.kind))
    )
      authorize(c, "materials.costView", resource(c, scope));
    const fileHash = hash(data);
    return scoped(
      c,
      async (tx) => {
        await validateScope(tx, c, scope);
        await lock(
          tx,
          `import:${c.tenantId}:${scope.legalEntityId}:${fileHash}`,
        );
        const existing = await tx.cloudImportBatch.findFirst({
          where: {
            tenantId: c.tenantId,
            legalEntityId: scope.legalEntityId,
            fileHash,
          },
        });
        if (existing)
          return {
            id: existing.id,
            fileHash,
            status: existing.status,
            preview: existing.preview,
            reconciliation: existing.reconciliation,
          };
        const seen = new Set<string>();
        const entries = [];
        for (const r of data.records) {
          const knownDemo =
            r.demo ||
            (r.kind === "customer" && /^c\d+$/.test(r.sourceId)) ||
            (r.kind === "product" && /^p\d+$/.test(r.sourceId)) ||
            ((r.kind === "sale" || r.kind === "quote") &&
              (r.data.legacyDemo === true ||
                (r.data.rate as { source?: string } | undefined)?.source ===
                  "legacy-demo"));
          const key = `${r.kind}:${r.sourceId}`;
          let status = knownDemo
            ? "excluded-demo"
            : seen.has(key)
              ? "invalid-duplicate-source"
              : "ready";
          seen.add(key);
          const target = await tx.cloudImportRecord.findFirst({
            where: {
              tenantId: c.tenantId,
              legalEntityId: scope.legalEntityId,
              kind: r.kind,
              sourceId: r.sourceId,
            },
          });
          if (target) status = "already-imported";
          const value = {
            ...r.data,
            ...scope,
            idempotencyKey: sourceKey(r.kind, r.sourceId),
          };
          const financial = r.kind === "sale" || r.kind === "quote";
          const parsed = financial
            ? historicalSchema.safeParse(r.data)
            : (r.kind === "customer"
                ? C.customerCreate
                : r.kind === "material"
                  ? C.materialCreate
                  : C.productCreate
              ).safeParse(value);
          if (!parsed.success && status === "ready") status = "invalid-fields";
          if (financial && parsed.success && status === "ready") {
            try {
              validateHistorical(parsed.data);
            } catch {
              status = "invalid-historical-totals";
            }
          }
          if (target && parsed.success) {
            const priorBatch = await tx.cloudImportBatch.findFirst({
              where: {
                id: target.batchId,
                tenantId: c.tenantId,
                legalEntityId: scope.legalEntityId,
              },
            });
            const priorEntry = (
              priorBatch?.preview as
                | {
                    entries?: {
                      kind: string;
                      sourceId: string;
                      data: unknown;
                    }[];
                  }
                | undefined
            )?.entries?.find(
              (e) => e.kind === r.kind && e.sourceId === r.sourceId,
            );
            if (!priorEntry || hash(priorEntry.data) !== hash(parsed.data))
              status = "invalid-source-conflict";
          }
          entries.push({
            sourceId: r.sourceId,
            kind: r.kind,
            status,
            data: parsed.success ? parsed.data : null,
          });
        }
        for (const e of entries.filter(
          (e) => ["sale", "quote"].includes(e.kind) && e.status === "ready",
        )) {
          const d = historicalSchema.parse(e.data),
            refs = [
              { kind: "customer", sourceId: d.customerSourceId },
              ...d.lines.map((l) => ({
                kind: "product",
                sourceId: l.productSourceId,
              })),
            ];
          for (const ref of refs) {
            if (
              entries.some(
                (e) =>
                  e.kind === ref.kind &&
                  e.sourceId === ref.sourceId &&
                  ["ready", "already-imported"].includes(e.status),
              )
            )
              continue;
            if (
              !(await tx.cloudImportRecord.findFirst({
                where: {
                  tenantId: c.tenantId,
                  legalEntityId: scope.legalEntityId,
                  ...ref,
                },
              }))
            ) {
              e.status = "invalid-unresolved-reference";
              break;
            }
          }
        }
        const preview = {
          version: 1,
          entries,
          counts: {
            ready: entries.filter((e) => e.status === "ready").length,
            excluded: entries.filter((e) => e.status === "excluded-demo")
              .length,
            alreadyImported: entries.filter(
              (e) => e.status === "already-imported",
            ).length,
            invalid: entries.filter((e) => e.status.startsWith("invalid"))
              .length,
            financialNeedsReview: data.financialRecords,
          },
          financialTotals: {
            importedSales: entries
              .filter((e) => e.kind === "sale" && e.status === "ready")
              .reduce(
                (sum, e) =>
                  sum.plus(historicalSchema.parse(e.data).expected.totalTry),
                new Decimal(0),
              )
              .toFixed(2),
            importedQuotes: entries
              .filter((e) => e.kind === "quote" && e.status === "ready")
              .reduce(
                (sum, e) =>
                  sum.plus(historicalSchema.parse(e.data).expected.totalTry),
                new Decimal(0),
              )
              .toFixed(2),
          },
        };
        const row = await tx.cloudImportBatch.create({
          data: {
            ...resource(c, scope),
            fileHash,
            status: "PREVIEW",
            preview: preview as Prisma.InputJsonValue,
          },
        });
        await audit(tx, c, scope, "IMPORT_PREVIEWED", row.id, preview.counts);
        return { id: row.id, fileHash, status: row.status, preview };
      },
      db,
      scope.legalEntityId,
    );
  }
  if (path[1] === "confirm") {
    const data = C.scopeSchema
      .extend({
        batchId: z.uuid(),
        fileHash: z.string().regex(/^[a-f0-9]{64}$/),
        approved: z.literal(true),
      })
      .strict()
      .parse(input);
    authorize(c, "imports.confirm", resource(c, data));
    await requireStepUp(headers, source);
    return scoped(
      c,
      async (tx) => {
        await validateScope(tx, c, data);
        await lock(tx, `import-confirm:${data.batchId}`);
        const batch = await tx.cloudImportBatch.findFirst({
          where: {
            id: data.batchId,
            tenantId: c.tenantId,
            legalEntityId: data.legalEntityId,
            activityId: data.activityId,
            createdById: c.userId,
            fileHash: data.fileHash,
          },
        });
        if (!batch) throw new AccessError(404, "IMPORT_NOT_FOUND");
        if (batch.status === "CONFIRMED")
          return {
            id: batch.id,
            reconciliation: batch.reconciliation,
            replayed: true,
          };
        if (Date.now() - batch.createdAt.getTime() > 30 * 60000)
          throw new AccessError(409, "IMPORT_PREVIEW_EXPIRED");
        const plan = batch.preview as {
          entries: {
            kind: string;
            sourceId: string;
            status: string;
            data: unknown;
          }[];
          counts: { invalid: number; financialNeedsReview: number };
        };
        if (plan.counts.invalid || plan.counts.financialNeedsReview)
          throw new AccessError(422, "IMPORT_REQUIRES_REVIEW");
        const actual = {
          customers: 0,
          materials: 0,
          products: 0,
          sales: 0,
          quotes: 0,
          skipped: 0,
          salesTotalTry: "0.00",
          quotesTotalTry: "0.00",
        };
        const ordered = [...plan.entries].sort(
          (a, b) =>
            Number(["sale", "quote"].includes(a.kind)) -
            Number(["sale", "quote"].includes(b.kind)),
        );
        for (const r of ordered) {
          if (r.status !== "ready") {
            actual.skipped++;
            continue;
          }
          await lock(
            tx,
            `import-record:${c.tenantId}:${data.legalEntityId}:${r.kind}:${r.sourceId}`,
          );
          if (
            await tx.cloudImportRecord.findFirst({
              where: {
                tenantId: c.tenantId,
                legalEntityId: data.legalEntityId,
                kind: r.kind,
                sourceId: r.sourceId,
              },
            })
          ) {
            actual.skipped++;
            continue;
          }
          const target =
            r.kind === "customer"
              ? await createCustomerRecord(
                  tx,
                  c,
                  C.customerCreate.parse(r.data),
                )
              : r.kind === "material"
                ? await createMaterialRecord(
                    tx,
                    c,
                    C.materialCreate.parse(r.data),
                  )
                : r.kind === "product"
                  ? await createProductRecord(
                      tx,
                      c,
                      C.productCreate.parse(r.data),
                    )
                  : await createHistorical(
                      tx,
                      c,
                      data,
                      r.kind as "sale" | "quote",
                      r.data,
                      sourceKey(r.kind, r.sourceId),
                      hash(r.data),
                    );
          await tx.cloudImportRecord.create({
            data: {
              id: randomUUID(),
              ...resource(c, data),
              batchId: batch.id,
              kind: r.kind,
              sourceId: r.sourceId,
              targetId: target.id,
            },
          });
          if (r.kind === "customer") actual.customers++;
          else if (r.kind === "material") actual.materials++;
          else if (r.kind === "product") actual.products++;
          else if (r.kind === "sale") {
            actual.sales++;
            actual.salesTotalTry = new Decimal(actual.salesTotalTry)
              .plus(historicalSchema.parse(r.data).expected.totalTry)
              .toFixed(2);
          } else {
            actual.quotes++;
            actual.quotesTotalTry = new Decimal(actual.quotesTotalTry)
              .plus(historicalSchema.parse(r.data).expected.totalTry)
              .toFixed(2);
          }
        }
        await tx.cloudImportBatch.update({
          where: { id: batch.id },
          data: { status: "CONFIRMED", reconciliation: actual },
        });
        await audit(tx, c, data, "IMPORT_CONFIRMED", batch.id, actual);
        return { id: batch.id, reconciliation: actual, replayed: false };
      },
      db,
      data.legalEntityId,
    );
  }
  void query;
  throw new AccessError(404, "NOT_FOUND");
}
