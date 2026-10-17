import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { masterFixture } from "./master-fixture";
import { cloudRequest } from "../../src/server/cloud/handler";
import { documentRequest } from "../../src/server/cloud/business/documents";
import { contextFor, scoped } from "../../src/server/authorization/context";
async function run() {
  const f = await masterFixture();
  let passed = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    await fn();
    console.log(`PASS ${++passed}: ${name}`);
  };
  try {
    const c = await contextFor(f.headers(), f.db, f.source),
      boot = await f.source.db.authBootstrap.findFirstOrThrow();
    const scope = { legalEntityId: boot.legalEntityId, activityId: null };
    async function request(path: string, method: string, body?: object) {
      const r = await cloudRequest(
        new Request(
          `http://127.0.0.1:3000/api/cloud/workspace/${path}?company=${scope.legalEntityId}`,
          {
            method,
            headers: f.headers(),
            ...(body ? { body: JSON.stringify(body) } : {}),
          },
        ),
        f.db,
        f.source,
      );
      return { status: r.status, body: await r.json() };
    }
    const customerData = {
      ...scope,
      idempotencyKey: randomUUID(),
      name: `D synthetic ${randomUUID()}`,
      email: "fixture@example.invalid",
    };
    let customerId = "",
      productId = "",
      materialId = "",
      variantId = "";
    await check(
      "real customer persisted; identical key replay; changed payload conflict",
      async () => {
        const r = await request("customers", "POST", customerData);
        assert.equal(r.status, 200);
        customerId = r.body.id;
        assert.equal(
          (await request("customers", "POST", customerData)).body.id,
          customerId,
        );
        assert.equal(
          (
            await request("customers", "POST", {
              ...customerData,
              name: "changed",
            })
          ).status,
          409,
        );
        assert.ok(
          (await request("customers", "GET")).body.some(
            (r: { id: string }) => r.id === customerId,
          ),
        );
      },
    );
    await check(
      "material USD manually entered, positive projection and versioned update",
      async () => {
        const r = await request("materials", "POST", {
          ...scope,
          idempotencyKey: randomUUID(),
          name: "D synthetic roll",
          unit: "square_meter",
          roll: true,
          margins: { left: 2, right: 2, top: 2, bottom: 2 },
          variants: [
            { name: "137", widthCm: 137, inStock: true, usdCost: "1.20" },
            { name: "152", widthCm: 152, inStock: true, usdCost: "1.20" },
          ],
        });
        assert.equal(r.status, 200);
        materialId = r.body.id;
        const m = (await request("catalog", "GET")).body.find(
          (m: { id: string }) => m.id === materialId,
        );
        variantId = m.variants.find(
          (v: { name: string }) => v.name === "152",
        ).id;
        assert.equal(m.variants[0].usdCost, "1.2");
        assert.equal(
          (
            await request(`variants/${variantId}/cost`, "PATCH", {
              ...scope,
              usdCost: "2",
              priceVersion: 1,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(`variants/${variantId}/cost`, "PATCH", {
              ...scope,
              usdCost: "3",
              priceVersion: 1,
            })
          ).status,
          409,
        );
      },
    );
    await check("real product creation", async () => {
      const r = await request("products", "POST", {
        ...scope,
        idempotencyKey: randomUUID(),
        name: "D synthetic printed product",
        kind: "manufacture",
        unit: "adet",
      });
      assert.equal(r.status, 200);
      productId = r.body.id;
    });
    const line = {
      productId: "",
      description: "D fixture",
      quantity: 1,
      widthCm: 135,
      heightCm: 200,
      discount: 0,
      vat: 20,
      costing: {
        materials: [
          {
            id: "use",
            materialId: "",
            variantId: "",
            widthCm: 135,
            heightCm: 200,
            quantity: 1,
            left: 2,
            right: 2,
            top: 2,
            bottom: 2,
            reusableM2: 0,
          },
        ],
        expenses: [],
        method: "margin",
        targetPercent: 50,
        manualNetUsd: null,
        vat: 20,
      },
    };
    line.productId = productId;
    line.costing.materials[0].materialId = materialId;
    line.costing.materials[0].variantId = variantId;
    const quote = {
      ...scope,
      customerId,
      idempotencyKey: randomUUID(),
      title: "D synthetic quote",
      rate: { kind: "tcmb" },
      lines: [line],
    };
    const provider = async () => ({
      source: "tcmb" as const,
      value: 50,
      publishedAt: new Date().toISOString().slice(0, 10),
      fetchedAt: new Date().toISOString(),
    });
    const doc = (kind: string, method: string, body: unknown) =>
      documentRequest(
        f.headers(),
        [kind],
        method,
        body,
        new URLSearchParams({ company: scope.legalEntityId }),
        f.db,
        f.source,
        provider,
      );
    let quoteId = "";
    await check(
      "authoritative 152cm consumption, quote snapshot and idempotency",
      async () => {
        const result = (await doc("quotes", "POST", quote)) as { id: string };
        quoteId = result.id;
        assert.equal(
          ((await doc("quotes", "POST", quote)) as { id: string }).id,
          quoteId,
        );
        const row = await scoped(
          c,
          (tx) => tx.cloudQuote.findUniqueOrThrow({ where: { id: quoteId } }),
          f.db,
          scope.legalEntityId,
        );
        assert.equal(row.costUsd.toString(), "6.2016");
        assert.equal(row.netUsd.toString(), "12.4032");
        assert.equal(row.totalTry.toString(), "744.19");
      },
    );
    await check(
      "137cm rejected; snapshot survives later price changes; quote revision append only",
      async () => {
        const m = (await request("catalog", "GET")).body.find(
          (m: { id: string }) => m.id === materialId,
        );
        const narrow = structuredClone(quote);
        narrow.idempotencyKey = randomUUID();
        narrow.lines[0].costing.materials[0].variantId = m.variants.find(
          (v: { name: string }) => v.name === "137",
        ).id;
        await assert.rejects(() => doc("quotes", "POST", narrow));
        assert.equal(
          (
            await request(`variants/${variantId}/cost`, "PATCH", {
              ...scope,
              usdCost: "4",
              priceVersion: 2,
            })
          ).status,
          200,
        );
        const revised = (await doc("quotes", "POST", {
          ...quote,
          previousId: quoteId,
          idempotencyKey: randomUUID(),
        })) as { id: string };
        const rows = await scoped(
          c,
          (tx) =>
            tx.cloudQuote.findMany({
              where: { id: { in: [quoteId, revised.id] } },
            }),
          f.db,
          scope.legalEntityId,
        );
        assert.equal(
          rows.find((r) => r.id === quoteId)!.costUsd.toString(),
          "6.2016",
        );
        assert.equal(rows.find((r) => r.id === revised.id)!.revision, 2);
      },
    );
    await check(
      "sale, lines and payment plans atomic; no cash movement; client totals rejected",
      async () => {
        const sale = {
          ...scope,
          customerId,
          idempotencyKey: randomUUID(),
          date: "2026-10-17",
          dueDate: "2026-11-17",
          currency: "TRY",
          notes: "synthetic only",
          rate: { kind: "tcmb" },
          lines: [line],
          plans: [],
        };
        const result = (await doc("sales", "POST", sale)) as { id: string };
        const row = await scoped(
          c,
          (tx) =>
            tx.cloudSale.findUniqueOrThrow({
              where: { id: result.id },
              include: { lines: true, plans: true },
            }),
          f.db,
          scope.legalEntityId,
        );
        assert.equal(row.lines.length, 1);
        assert.equal(row.plans.length, 0);
        await assert.rejects(() =>
          scoped(
            c,
            (tx) =>
              tx.$executeRaw`INSERT INTO "CloudPaymentPlan"(id,"tenantId","legalEntityId","saleId","dueDate",method,amount) VALUES(${randomUUID()}::uuid,${c.tenantId}::uuid,${scope.legalEntityId}::uuid,${row.id}::uuid,'2026-11-17','Nakit',1)`,
            f.db,
            scope.legalEntityId,
          ),
        );
        await assert.rejects(() =>
          scoped(
            c,
            (tx) =>
              tx.$executeRaw`INSERT INTO "CloudSaleLine"(id,"tenantId","legalEntityId","saleId","productId",description,quantity,"widthCm","heightCm",discount,vat,snapshot,"costUsd","netUsd","netTry","vatTry","totalTry") SELECT ${randomUUID()}::uuid,"tenantId","legalEntityId","saleId","productId",description,quantity,"widthCm","heightCm",discount,vat,snapshot,"costUsd","netUsd","netTry","vatTry","totalTry" FROM "CloudSaleLine" WHERE "saleId"=${row.id}::uuid`,
            f.db,
            scope.legalEntityId,
          ),
        );
        await assert.rejects(() =>
          doc("sales", "POST", {
            ...sale,
            idempotencyKey: randomUUID(),
            totalTry: 1,
          }),
        );
        await assert.rejects(() =>
          doc("sales", "POST", {
            ...sale,
            idempotencyKey: randomUUID(),
            plans: [{ dueDate: "2026-11-17", method: "Nakit", amount: "1" }],
          }),
        );
      },
    );
    await check("unauthenticated requests rejected", async () => {
      const r = await cloudRequest(
        new Request(
          `http://127.0.0.1:3000/api/cloud/workspace/catalog?company=${scope.legalEntityId}`,
        ),
        f.db,
        f.source,
      );
      assert.equal(r.status, 401);
    });
    await check(
      "explicit deny removes all nested catalog and document costs immediately",
      async () => {
        const override = await scoped(
          c,
          async (tx) => {
            const s = await tx.permissionScope.create({
              data: { tenantId: c.tenantId, kind: "TENANT" },
            });
            return tx.userPermissionOverride.create({
              data: {
                tenantId: c.tenantId,
                membershipId: c.membershipId,
                scopeId: s.id,
                permissionId: "materials.costView",
                effect: "DENY",
              },
            });
          },
          f.db,
          scope.legalEntityId,
        );
        try {
          const catalogs = await request("catalog", "GET");
          assert.equal(catalogs.status, 200);
          assert.ok(
            catalogs.body.every((m: { variants: object[] }) =>
              m.variants.every((v) => !("usdCost" in v)),
            ),
          );
          const docs = await doc("quotes", "GET", undefined);
          const serialized = JSON.stringify(docs);
          assert.ok(
            !/costUsd|snapshot|profit|margin|usdCost|targetPercent/.test(
              serialized,
            ),
          );
        } finally {
          await scoped(
            c,
            (tx) =>
              tx.userPermissionOverride.delete({ where: { id: override.id } }),
            f.db,
            scope.legalEntityId,
          );
        }
      },
    );
    await check(
      "preview excludes demo; explicit confirm imports once and reconciles",
      async () => {
        const sourceId = randomUUID(),
          materialSource = randomUUID();
        const body = {
          ...scope,
          records: [
            {
              sourceId: "c1",
              kind: "customer",
              data: { name: "Demo excluded" },
            },
            {
              sourceId,
              kind: "customer",
              data: { name: `Imported synthetic ${sourceId}` },
            },
            {
              sourceId: materialSource,
              kind: "material",
              data: {
                name: "Imported history fixture",
                unit: "square_meter",
                roll: true,
                margins: { left: 2, right: 2, top: 2, bottom: 2 },
                variants: [
                  {
                    name: "152",
                    widthCm: 152,
                    inStock: true,
                    usdCost: "2",
                    history: [
                      {
                        at: "2026-09-01T12:00:00.000Z",
                        previous: null,
                        next: 1,
                        userId: "old-user",
                        userName: "Legacy fixture",
                      },
                      {
                        at: "2026-09-02T12:00:00.000Z",
                        previous: 1,
                        next: 2,
                        userId: "old-user",
                        userName: "Legacy fixture",
                      },
                    ],
                  },
                ],
              },
            },
          ],
        };
        const preview = await request("imports/preview", "POST", body);
        assert.equal(preview.status, 200);
        assert.equal(preview.body.preview.counts.ready, 2);
        assert.equal(preview.body.preview.counts.excluded, 1);
        const command = {
          ...scope,
          batchId: preview.body.id,
          fileHash: preview.body.fileHash,
          approved: true,
        };
        const confirm = await request("imports/confirm", "POST", command);
        assert.equal(confirm.status, 200);
        assert.equal(confirm.body.reconciliation.customers, 1);
        assert.equal(confirm.body.reconciliation.materials, 1);
        const imported = await scoped(
          c,
          async (tx) => {
            const m = await tx.cloudImportRecord.findFirstOrThrow({
              where: {
                tenantId: c.tenantId,
                legalEntityId: scope.legalEntityId,
                sourceId: materialSource,
                kind: "material",
              },
            });
            return tx.materialVariant.findFirstOrThrow({
              where: { materialId: m.targetId },
              include: { history: true },
            });
          },
          f.db,
          scope.legalEntityId,
        );
        assert.equal(imported.history.length, 3);
        assert.equal(
          imported.history.filter((h) => h.actorId.startsWith("legacy:"))
            .length,
          2,
        );
        assert.equal(imported.priceVersion, 3);
        assert.equal(
          (await request("imports/confirm", "POST", command)).body.replayed,
          true,
        );
        const changed = await request("imports/preview", "POST", {
          ...scope,
          records: [
            {
              sourceId,
              kind: "customer",
              data: { name: "conflicting changed source" },
            },
          ],
        });
        assert.equal(changed.body.preview.counts.invalid, 1);
      },
    );
    await check(
      "historical quote and sale import independently validates USD/TRY and preserves original price",
      async () => {
        const cs = randomUUID(),
          ps = randomUUID(),
          ss = randomUUID(),
          qs = randomUUID();
        const historical = {
          customerSourceId: cs,
          title: "Synthetic historical",
          date: "2026-09-01",
          dueDate: "2026-10-01",
          currency: "TRY",
          rate: {
            source: "manual",
            value: 40,
            publishedAt: "2026-09-01",
            fetchedAt: "2026-09-01T12:00:00.000Z",
            reason: "isolated historical fixture",
          },
          lines: [
            {
              productSourceId: ps,
              description: "Historical roll",
              quantity: 1,
              widthCm: 135,
              heightCm: 200,
              discount: 0,
              vat: 20,
              costing: line.costing,
              catalog: {
                materials: [
                  {
                    id: materialId,
                    name: "Historical material",
                    unit: "square_meter",
                    roll: true,
                    variants: [
                      {
                        id: variantId,
                        name: "152",
                        widthCm: 152,
                        usdCost: "1",
                      },
                    ],
                  },
                ],
                expenses: [],
              },
            },
          ],
          expected: {
            costUsd: "3.100800",
            netUsd: "6.201600",
            netTry: "248.06",
            vatTry: "49.61",
            totalTry: "297.67",
          },
          plans: [],
        };
        const records = [
          {
            sourceId: cs,
            kind: "customer",
            data: { name: `D historical customer ${cs}` },
          },
          {
            sourceId: ps,
            kind: "product",
            data: {
              name: "Historical product",
              kind: "manufacture",
              unit: "adet",
            },
          },
          { sourceId: ss, kind: "sale", data: historical },
          { sourceId: qs, kind: "quote", data: historical },
        ];
        const p = await request("imports/preview", "POST", {
          ...scope,
          records,
        });
        assert.equal(p.status, 200);
        assert.equal(p.body.preview.counts.invalid, 0);
        assert.equal(p.body.preview.financialTotals.importedSales, "297.67");
        const r = await request("imports/confirm", "POST", {
          ...scope,
          batchId: p.body.id,
          fileHash: p.body.fileHash,
          approved: true,
        });
        assert.equal(r.status, 200);
        assert.equal(r.body.reconciliation.salesTotalTry, "297.67");
        assert.equal(r.body.reconciliation.quotesTotalTry, "297.67");
        const bad = structuredClone(historical);
        bad.expected.totalTry = "1";
        const invalid = await request("imports/preview", "POST", {
          ...scope,
          records: [{ sourceId: randomUUID(), kind: "sale", data: bad }],
        });
        assert.equal(invalid.body.preview.counts.invalid, 1);
      },
    );
    await check(
      "missing scope defaults deny, immutable rows reject SQL updates, foreign company rejected",
      async () => {
        assert.equal(await f.db.cloudSale.count(), 0);
        await assert.rejects(() =>
          scoped(
            c,
            (tx) =>
              tx.$executeRaw`UPDATE "CloudQuote" SET title='tampered' WHERE id=${quoteId}::uuid`,
            f.db,
            scope.legalEntityId,
          ),
        );
        const r = await request("customers", "POST", {
          ...customerData,
          legalEntityId: randomUUID(),
          idempotencyKey: randomUUID(),
        });
        assert.equal(r.status, 404);
      },
    );
    console.log(
      `Sprint D ${passed}/${passed}; isolated synthetic test DB only`,
    );
  } finally {
    await f.close();
  }
}
run().catch((e) => {
  console.error(
    "SPRINT_D_FAILED",
    typeof e.code === "string" && /^P\d{4}$/.test(e.code) ? e.code : "",
    e instanceof assert.AssertionError
      ? e.message
      : e instanceof Error
        ? e.name
        : "ERROR",
  );
  process.exitCode = 1;
});
