// V4.3a local-only acceptance. No env loading, Neon or R2 client.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { masterFixture } from "../auth/master-fixture";
import { cloudRequest } from "../../src/server/cloud/handler";
import { contextFor, scoped } from "../../src/server/authorization/context";
import { expectedTables, expectedForcedTables } from "../backup/postgres";

async function main() {
  if (!process.env.PUSULA_LOCAL_FIXTURE) throw new Error("Local fixture only");
  const f = await masterFixture(),
    admin = new Client({
      connectionString: process.env.TEST_DIRECT_DATABASE_URL,
    });
  await admin.connect();
  let checks = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    await fn();
    console.log(`PASS ${++checks}: ${name}`);
  };
  try {
    const c = await contextFor(f.headers(), f.db, f.source),
      boot = await f.source.db.authBootstrap.findFirstOrThrow();
    const scope = { legalEntityId: boot.legalEntityId, activityId: null };
    const query = new URLSearchParams({ company: scope.legalEntityId });
    const request = async (
      path: string,
      method = "GET",
      body?: object,
      headers = f.headers(),
    ) => {
      const r = await cloudRequest(
        new Request(
          `http://127.0.0.1:3000/api/cloud/workspace/${path}${path.includes("?") ? "&" : "?"}${query}`,
          { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) },
        ),
        f.db,
        f.source,
      );
      return { status: r.status, body: await r.json() };
    };
    // Fixtures: material + supplier + links + verified USD offers.
    const today = new Date().toISOString().slice(0, 10);
    const digest = async () =>
      (
        await admin.query(
          `SELECT md5(coalesce(string_agg(rowval,'|' ORDER BY rowval),'')) AS hash FROM (SELECT to_jsonb(v)::text AS rowval FROM "MaterialVariant" v WHERE v."tenantId"=$1 UNION ALL SELECT to_jsonb(h)::text FROM "MaterialPriceHistory" h WHERE h."tenantId"=$1 UNION ALL SELECT to_jsonb(q)::text FROM "CloudQuote" q WHERE q."tenantId"=$1 UNION ALL SELECT to_jsonb(s)::text FROM "CloudSale" s WHERE s."tenantId"=$1 UNION ALL SELECT to_jsonb(l)::text FROM "CloudSaleLine" l WHERE l."tenantId"=$1) x`,
          [c.tenantId],
        )
      ).rows[0].hash;
    const material = await request("materials", "POST", {
      ...scope,
      idempotencyKey: randomUUID(),
      name: "V43 Fictional Vinyl",
      unit: "square_meter",
      roll: true,
      category: "Test",
      margins: { left: 0, right: 0, top: 0, bottom: 0 },
      variants: [
        { name: "152cm", widthCm: 152, usdCost: "4.000000", inStock: true },
        { name: "137cm", widthCm: 137, usdCost: "5.000000", inStock: true },
      ],
    });
    assert.equal(material.status, 200);
    const variants = await scoped(
      c,
      (tx) =>
        tx.materialVariant.findMany({
          where: { materialId: material.body.id },
          orderBy: { name: "asc" },
        }),
      f.db,
      scope.legalEntityId,
    );
    const v152 = variants.find((v) => v.widthCm.toString() === "152")!;
    const v137 = variants.find((v) => v.widthCm.toString() === "137")!;
    const supplier = await request("suppliers", "POST", {
      ...scope,
      idempotencyKey: randomUUID(),
      name: "V43 Fictional Supplier",
      tradeName: "Imaginary Soft Ltd",
      defaultCurrency: "USD",
      leadTimeDays: 2,
    });
    assert.equal(supplier.status, 200);
    const supplierId = supplier.body.id;
    const link = async (variantId: string, sku: string) => {
      const r = await request(`suppliers/${supplierId}/materials`, "POST", {
        ...scope,
        variantId,
        idempotencyKey: randomUUID(),
        supplierSku: sku,
        purchaseUnit: "linear_meter",
        minOrderQty: "1",
        leadTimeDays: 2,
      });
      assert.equal(r.status, 200);
      return r.body.id as string;
    };
    const linkA = await link(v152.id, "PO-VINYL-152");
    const linkB = await link(v137.id, "PO-VINYL-137");
    const offer = async (linkId: string, price: string) => {
      const r = await request("supplier-offers", "POST", {
        ...scope,
        supplierMaterialId: linkId,
        idempotencyKey: randomUUID(),
        originalCurrency: "USD",
        originalUnitPrice: price,
        purchaseUnit: "linear_meter",
        minQty: "1",
        maxQty: null,
        offeredOn: today,
        validFrom: today,
        validUntil: null,
        supplierReference: "Synthetic RFQ",
        notes: "No real business data",
      });
      assert.equal(r.status, 200);
      return r.body.id as string;
    };
    const offerA = await offer(linkA, "15.200000");
    const offerB = await offer(linkB, "6.500000");
    const before = await digest();
    const offerLine = (
      supplierMaterialId: string,
      offerVersionId: string,
      orderedQty: string,
    ) => ({
      supplierMaterialId,
      offerVersionId,
      orderedQty,
      purchaseUnit: "linear_meter",
      expectedDate: null,
      manualCurrency: null,
      manualUnitPrice: null,
    });
    type OrderLine =
      ReturnType<typeof offerLine> | ReturnType<typeof manualLine>;
    const manualLine = (
      supplierMaterialId: string,
      orderedQty: string,
      currency: string,
      price: string,
    ) => ({
      supplierMaterialId,
      offerVersionId: null,
      orderedQty,
      purchaseUnit: "linear_meter",
      expectedDate: null,
      manualCurrency: currency,
      manualUnitPrice: price,
    });
    const createBody = (
      idempotencyKey: string,
      lines: OrderLine[],
      supplierIdValue = supplierId,
    ) => ({
      ...scope,
      supplierId: supplierIdValue,
      idempotencyKey,
      lines,
      revisesOrderId: null,
    });
    const detailFor = (id: string) => request(`purchase-orders/${id}`);
    let orderA = "",
      orderB = "",
      orderC = "",
      orderD = "";
    const year = new Date().getFullYear().toString();

    await check(
      "multi-line offer-backed draft order; same-key replay and conflicting payload 409",
      async () => {
        const body = createBody(randomUUID(), [
          offerLine(linkA, offerA, "10"),
          offerLine(linkB, offerB, "3"),
        ]);
        const a = await request("purchase-orders", "POST", body);
        assert.equal(a.status, 200);
        orderA = a.body.id;
        assert.equal(
          (await request("purchase-orders", "POST", body)).body.id,
          orderA,
        );
        assert.equal(
          (
            await request("purchase-orders", "POST", {
              ...body,
              lines: [offerLine(linkA, offerA, "11")],
            })
          ).status,
          409,
        );
        const detail = await detailFor(orderA);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.status, "DRAFT");
        assert.equal(detail.body.revision, 1);
        assert.match(
          detail.body.businessNo,
          new RegExp(`^PO-${year}-[0-9]{4}$`),
        );
        assert.equal(detail.body.lineCount, 2);
        assert.equal(
          (
            await request("purchase-orders", "POST", {
              ...body,
              idempotencyKey: randomUUID(),
              revisesOrderId: orderA,
            })
          ).status,
          422,
        );
        assert.equal(await digest(), before);
      },
    );

    await check(
      "list shows order with lineCount; status/supplier filters and search",
      async () => {
        const list = await request("purchase-orders");
        assert.equal(list.status, 200);
        const row = list.body.find((r: { id: string }) => r.id === orderA) as
          { lineCount: number } | undefined;
        assert(row);
        assert.equal(row.lineCount, 2);
        const drafts = await request("purchase-orders?status=DRAFT");
        assert((drafts.body as { id: string }[]).some((r) => r.id === orderA));
        const approved = await request("purchase-orders?status=APPROVED");
        assert(
          !(approved.body as { id: string }[]).some((r) => r.id === orderA),
        );
        const mixed = await request("purchase-orders?status=DRAFT,APPROVED");
        assert((mixed.body as { id: string }[]).some((r) => r.id === orderA));
        assert.equal(
          (await request("purchase-orders?status=BOGUS")).status,
          400,
        );
      },
    );

    await check(
      "detail freezes exact Decimal conversion and USD totals for master",
      async () => {
        const detail = await detailFor(orderA);
        const [l1, l2] = detail.body.lines as Record<string, unknown>[];
        assert.equal(l1.lineNo, 1);
        assert.equal(l1.supplierSku, "PO-VINYL-152");
        assert.equal(l1.orderedQty, "10");
        assert.equal(l1.orderedBaseQty, "15.2");
        assert.equal(l1.baseUnit, "square_meter");
        assert.equal(l1.priceSource, "OFFER");
        assert.equal(l1.offerRevision, 1);
        assert.equal(l1.originalCurrency, "USD");
        assert.equal(l1.originalUnitPrice, "15.2");
        assert.equal(l1.normalizedUsdUnitPrice, "10.000000000");
        assert.equal(l1.lineTotalUsd, "152.000000000");
        assert.equal(l2.orderedBaseQty, "4.11");
        assert.equal(l2.lineTotalUsd, "19.500000000");
        assert.equal(detail.body.totalUsd, "171.500000000");
        assert.equal(detail.body.pendingLines, 0);
        assert.equal(detail.body.approvedAt, null);
      },
    );

    await check(
      "explicit cost DENY redacts prices and blocks manual-price creation",
      async () => {
        const scopeId = randomUUID(),
          override = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'LEGAL_ENTITY\',$3)',
          [scopeId, c.tenantId, scope.legalEntityId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId","scopeId",effect) VALUES($1,$2,$3,\'purchases.costView\',$4,\'DENY\')',
          [override, c.tenantId, c.membershipId, scopeId],
        );
        try {
          const detail = await detailFor(orderA);
          assert.equal(detail.status, 200);
          assert(
            !/lineTotalUsd|normalizedUsd|originalUnitPrice|fxSnapshot|variantUsdCost|totalUsd|pendingLines/.test(
              JSON.stringify(detail.body),
            ),
          );
          assert.equal(detail.body.lines.length, 2);
          assert.equal(
            (
              await request("purchase-orders", "POST", {
                ...createBody(randomUUID(), [
                  manualLine(linkA, "1", "USD", "2.500000"),
                ]),
              })
            ).status,
            403,
          );
        } finally {
          await admin.query(
            'DELETE FROM "UserPermissionOverride" WHERE id=$1',
            [override],
          );
        }
      },
    );

    await check(
      "revoked view permission hides detail/list and blocks creation",
      async () => {
        const scopeId = randomUUID(),
          override = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'LEGAL_ENTITY\',$3)',
          [scopeId, c.tenantId, scope.legalEntityId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId","scopeId",effect) VALUES($1,$2,$3,\'purchases.view\',$4,\'DENY\')',
          [override, c.tenantId, c.membershipId, scopeId],
        );
        try {
          assert.equal((await detailFor(orderA)).status, 404);
          assert(
            !((await request("purchase-orders")).body as { id: string }[]).some(
              (r) => r.id === orderA,
            ),
          );
          assert.equal(
            (
              await request("purchase-orders", "POST", {
                ...createBody(randomUUID(), [offerLine(linkA, offerA, "1")]),
              })
            ).status,
            403,
          );
        } finally {
          await admin.query(
            'DELETE FROM "UserPermissionOverride" WHERE id=$1',
            [override],
          );
        }
        assert.equal(await digest(), before);
      },
    );

    await check(
      "manual-price line records MANUAL snapshot and requires costView",
      async () => {
        const b = await request("purchase-orders", "POST", {
          ...createBody(randomUUID(), [manualLine(linkB, "2", "USD", "5")]),
        });
        assert.equal(b.status, 200);
        orderB = b.body.id;
        const detail = await detailFor(orderB);
        const [l1] = detail.body.lines as Record<string, unknown>[];
        assert.equal(l1.priceSource, "MANUAL");
        assert.equal(l1.offerRevision, null);
        assert.equal(l1.normalizedUsdUnitPrice, "3.649635036");
        assert.equal(l1.orderedBaseQty, "2.74");
        assert.equal(l1.lineTotalUsd, "10.000000000");
        assert.equal(detail.body.totalUsd, "10.000000000");
      },
    );

    await check(
      "EUR/GBP never fabricate USD; TRY only follows an explicit TCMB snapshot",
      async () => {
        const e = await request("purchase-orders", "POST", {
          ...createBody(randomUUID(), [
            manualLine(linkA, "1", "EUR", "2"),
            manualLine(linkB, "1", "GBP", "3"),
          ]),
        });
        assert.equal(e.status, 200);
        orderC = e.body.id;
        const detail = await detailFor(orderC);
        for (const l of detail.body.lines as Record<string, unknown>[]) {
          assert.equal(l.normalizedUsdUnitPrice, null);
          assert.equal(l.lineTotalUsd, null);
          const fx = l.fxSnapshot as { status: string; reason?: string };
          assert.equal(fx.status, "unavailable");
          assert.equal(fx.reason, "CURRENCY_SOURCE_UNVERIFIED");
        }
        assert.equal(detail.body.totalUsd, null);
        assert.equal(detail.body.pendingLines, 2);
        const t = await request("purchase-orders", "POST", {
          ...createBody(randomUUID(), [manualLine(linkA, "1", "TRY", "2")]),
        });
        assert.equal(t.status, 200);
        orderD = t.body.id;
        const tryDetail = await detailFor(orderD);
        const [tryLine] = tryDetail.body.lines as Record<string, unknown>[];
        const tryFx = tryLine.fxSnapshot as {
          status: string;
          source?: string;
        } | null;
        if (tryLine.normalizedUsdUnitPrice === null)
          assert(tryFx === null || tryFx.status === "unavailable");
        else {
          assert.equal(tryFx?.status, "verified");
          assert.equal(tryFx?.source, "tcmb");
        }
      },
    );

    await check(
      "draft edit replaces all lines; stale version conflicts 409",
      async () => {
        const patched = await request(`purchase-orders/${orderA}`, "PATCH", {
          ...scope,
          version: 1,
          lines: [offerLine(linkA, offerA, "11")],
        });
        assert.equal(patched.status, 200);
        assert.equal(patched.body.version, 2);
        const detail = await detailFor(orderA);
        assert.equal((detail.body.lines as unknown[]).length, 1);
        const [l1] = detail.body.lines as Record<string, unknown>[];
        assert.equal(l1.lineNo, 1);
        assert.equal(l1.orderedQty, "11");
        assert.equal(l1.lineTotalUsd, "167.200000000");
        assert.equal(detail.body.totalUsd, "167.200000000");
        assert.equal(
          (
            await request(`purchase-orders/${orderA}`, "PATCH", {
              ...scope,
              version: 1,
              lines: [offerLine(linkA, offerA, "12")],
            })
          ).status,
          409,
        );
        assert.equal(await digest(), before);
      },
    );

    await check(
      "approve stamps approver; re-approve and stale concurrent approve rejected",
      async () => {
        const approved = await request(
          `purchase-orders/${orderA}/approve`,
          "POST",
          { ...scope, version: 2 },
        );
        assert.equal(approved.status, 200);
        assert.equal(approved.body.approved, true);
        assert.equal(
          (
            await request(`purchase-orders/${orderA}/approve`, "POST", {
              ...scope,
              version: 3,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(`purchase-orders/${orderB}/approve`, "POST", {
              ...scope,
              version: 99,
            })
          ).status,
          409,
        );
        const detail = await detailFor(orderA);
        assert.equal(detail.body.status, "APPROVED");
        assert(detail.body.approvedAt);
        const stamp = (
          await admin.query(
            'SELECT "approvedAt","approvedById",version FROM "PurchaseOrder" WHERE id=$1',
            [orderA],
          )
        ).rows[0];
        assert.equal(stamp.approvedById, c.userId);
        assert.equal(stamp.version, 3);
        const lineNow = (
          await admin.query(
            'SELECT count(*)::int AS n FROM "PurchaseOrderLine" WHERE "orderId"=$1',
            [orderA],
          )
        ).rows[0].n;
        assert.equal(lineNow, 1);
      },
    );

    await check(
      "approved order cannot be edited again; cancellation seals all paths",
      async () => {
        assert.equal(
          (
            await request(`purchase-orders/${orderA}`, "PATCH", {
              ...scope,
              version: 3,
              lines: [offerLine(linkA, offerA, "5")],
            })
          ).status,
          409,
        );
        const cancelled = await request(
          `purchase-orders/${orderA}/cancel`,
          "POST",
          {
            ...scope,
            version: 3,
          },
        );
        assert.equal(cancelled.status, 200);
        assert.equal(
          (
            await request(`purchase-orders/${orderA}/cancel`, "POST", {
              ...scope,
              version: 4,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(`purchase-orders/${orderA}/approve`, "POST", {
              ...scope,
              version: 3,
            })
          ).status,
          409,
        );
        assert.equal((await detailFor(orderA)).body.status, "CANCELLED");
        assert.equal(await digest(), before);
      },
    );

    await check(
      "database guards: immutable identity, forced version step, sealed lines",
      async () => {
        await assert.rejects(
          admin.query(
            'UPDATE "PurchaseOrder" SET "businessNo"=\'PO-9999-0001\' WHERE id=$1',
            [orderB],
          ),
          (e: unknown) => (e as { code: string }).code === "23514",
        );
        await assert.rejects(
          admin.query(
            "UPDATE \"PurchaseOrder\" SET status='APPROVED' WHERE id=$1 AND status='DRAFT'",
            [orderB],
          ),
          (e: unknown) => (e as { code: string }).code === "23514",
        );
        await assert.rejects(
          admin.query(
            'UPDATE "PurchaseOrderLine" SET "orderedQty"=99 WHERE "orderId"=$1',
            [orderB],
          ),
          (e: unknown) => (e as { code: string }).code === "23514",
        );
        await assert.rejects(
          admin.query('DELETE FROM "PurchaseOrderLine" WHERE "orderId"=$1', [
            orderA,
          ]),
          (e: unknown) => (e as { code: string }).code === "23514",
        );
        // Positive control: a fresh owned line on the still-draft order is allowed.
        const insertLine = await admin.query(
          'INSERT INTO "PurchaseOrderLine" SELECT $1::uuid,"tenantId","legalEntityId","activityId","createdById","createdAt","orderId",2,"supplierMaterialId","offerVersionId","variantId","orderedQty","purchaseUnit","orderedBaseQty","baseUnit","conversionSnapshot","priceSnapshot","expectedDate" FROM "PurchaseOrderLine" WHERE "orderId"=$2 LIMIT 1 RETURNING id',
          [randomUUID(), orderB],
        );
        assert.equal(insertLine.rowCount, 1);
        await admin.query('DELETE FROM "PurchaseOrderLine" WHERE id=$1', [
          insertLine.rows[0].id,
        ]);
      },
    );

    await check(
      "concurrent same-key creates collapse to one order; numbers unique",
      async () => {
        const body = createBody(randomUUID(), [offerLine(linkA, offerA, "1")]);
        const parallel = await Promise.all([
          request("purchase-orders", "POST", body),
          request("purchase-orders", "POST", body),
          request("purchase-orders", "POST", body),
        ]);
        assert(parallel.every((r) => r.status === 200));
        assert.equal(new Set(parallel.map((r) => r.body.id as string)).size, 1);
        assert.equal(
          parallel[0].body.id !== orderA && parallel[0].body.id !== orderB,
          true,
        );
        const e = await request("purchase-orders", "POST", {
          ...createBody(randomUUID(), [offerLine(linkB, offerB, "1")]),
        });
        assert.equal(e.status, 200);
        const list = await request("purchase-orders");
        const nos = (list.body as { businessNo: string }[]).map(
          (r) => r.businessNo,
        );
        assert(new Set(nos).size === nos.length);
        assert(nos.every((n) => new RegExp(`^PO-${year}-[0-9]{4}$`).test(n)));
      },
    );

    await check(
      "foreign tenant and foreign company stay invisible; scope via real APIs",
      async () => {
        const tenant = randomUUID(),
          entity = randomUUID(),
          material = randomUUID(),
          variant = randomUUID(),
          foreignSupplier = randomUUID(),
          foreignLink = randomUUID(),
          foreignOrder = randomUUID();
        await admin.query(
          "INSERT INTO \"Tenant\"(id,name) VALUES($1,'Foreign V43 tenant')",
          [tenant],
        );
        await admin.query(
          'INSERT INTO "LegalEntity"(id,"tenantId",name) VALUES($1,$2,\'Foreign V43 entity\')',
          [entity, tenant],
        );
        await admin.query(
          'INSERT INTO "Material"(id,"tenantId","legalEntityId",name,unit) VALUES($1,$2,$3,\'Foreign V43 material\',\'piece\')',
          [material, tenant, entity],
        );
        await admin.query(
          'INSERT INTO "MaterialVariant"(id,"tenantId","legalEntityId","materialId",name,"widthCm") VALUES($1,$2,$3,$4,\'Foreign V43 variant\',1)',
          [variant, tenant, entity, material],
        );
        await admin.query(
          'INSERT INTO "Supplier"(id,"tenantId","legalEntityId","createdById","idempotencyKey","payloadHash",name,"defaultCurrency","leadTimeDays") VALUES($1,$2,$3,$4,$5,$6,\'Foreign V43 supplier\',\'USD\',1)',
          [
            foreignSupplier,
            tenant,
            entity,
            c.userId,
            randomUUID(),
            "a".repeat(64),
          ],
        );
        await admin.query(
          'INSERT INTO "SupplierMaterial"(id,"tenantId","legalEntityId","createdById","idempotencyKey","payloadHash","supplierId","variantId","supplierSku","purchaseUnit","minOrderQty","leadTimeDays") VALUES($1,$2,$3,$4,$5,$6,$7,$8,\'Foreign V43 sku\',\'piece\',1,0)',
          [
            foreignLink,
            tenant,
            entity,
            c.userId,
            randomUUID(),
            "a".repeat(64),
            foreignSupplier,
            variant,
          ],
        );
        await admin.query(
          'INSERT INTO "PurchaseOrder"(id,"tenantId","legalEntityId","activityId","createdById","idempotencyKey","payloadHash","supplierId","businessNo",revision,"revisesOrderId",status,version) VALUES($1,$2,$3,NULL,$4,$5,$6,$7,\'PO-9999-7777\',1,NULL,\'DRAFT\',1)',
          [
            foreignOrder,
            tenant,
            entity,
            c.userId,
            randomUUID(),
            "a".repeat(64),
            foreignSupplier,
          ],
        );
        // Foreign header is sufficient for negative visibility; malformed line fixtures are forbidden.
        assert.equal((await detailFor(foreignOrder)).status, 404);
        const rows = await scoped(
          { tenantId: tenant, userId: c.userId },
          (tx) => tx.purchaseOrder.findMany(),
          f.db,
          entity,
        );
        assert.equal(rows.length, 0);
        const other = (
          await admin.query(
            'INSERT INTO "LegalEntity"(id,"tenantId",name) VALUES($1,$2,\'Other V43 entity\') RETURNING id',
            [randomUUID(), c.tenantId],
          )
        ).rows[0].id;
        const foreign = await cloudRequest(
          new Request(
            `http://127.0.0.1:3000/api/cloud/workspace/purchase-orders/${orderA}?company=${other}`,
            { headers: f.headers() },
          ),
          f.db,
          f.source,
        );
        assert.equal(foreign.status, 404);
      },
    );

    await check(
      "audit events recorded for created, updated, approved and cancelled orders",
      async () => {
        for (const [action, id] of [
          ["PURCHASE_ORDER_CREATED", orderA],
          ["PURCHASE_ORDER_UPDATED", orderA],
          ["PURCHASE_ORDER_APPROVED", orderA],
          ["PURCHASE_ORDER_CANCELLED", orderA],
        ] as const) {
          const r = (
            await admin.query(
              'SELECT count(*)::int AS n FROM "AuditEvent" WHERE action=$1 AND "targetId"=$2 AND "tenantId"=$3',
              [action, id, c.tenantId],
            )
          ).rows[0];
          assert.equal(r.n, 1, action);
        }
      },
    );

    await check(
      "F01: real non-master session, OWN and ACTIVITY scopes and explicit material DENY",
      async () => {
        const { inviteUser, acceptInvitation } =
          await import("../../src/server/auth/invitations");
        const { authRequest } = await import("../../src/server/auth/core");
        const email = "po-" + randomUUID() + "@example.invalid",
          password = randomUUID() + randomUUID();
        const invitation = await inviteUser(
          f.headers(),
          { email, name: "PO normal fixture" },
          f.db,
          f.source,
        );
        const token = new URL(f.messages.at(-1)!.url).searchParams.get(
          "token",
        )!;
        await acceptInvitation({ token, password }, f.db, f.source);
        const signed = await authRequest(
          new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
            method: "POST",
            headers: {
              Origin: "http://127.0.0.1:3000",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
          }),
          f.source,
        );
        assert.equal(signed.status, 200);
        const cookie = signed.headers
          .getSetCookie()
          .map((s) => s.split(";")[0])
          .join("; ");
        const h = new Headers({
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
          cookie,
          "x-pusula-membership": invitation.membershipId!,
        });
        const own = randomUUID(),
          legal = randomUUID(),
          activityScope = randomUUID(),
          ads = randomUUID(),
          other = randomUUID();
        await admin.query(
          'INSERT INTO "Activity"(id,"tenantId","legalEntityId",name) VALUES($1,$2,$3,\'PO ads\'),($4,$2,$3,\'PO software\')',
          [ads, c.tenantId, scope.legalEntityId, other],
        );
        for (const [id, kind, activityId] of [
          [own, "OWN", null],
          [legal, "LEGAL_ENTITY", null],
          [activityScope, "ACTIVITY", ads],
        ])
          await admin.query(
            'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId","activityId") VALUES($1,$2,$3,$4,$5)',
            [id, c.tenantId, kind, scope.legalEntityId, activityId],
          );
        const grant = async (
          permission: string,
          scopeId: string,
          effect = "ALLOW",
        ) => {
          const id = randomUUID();
          await admin.query(
            'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId","scopeId",effect) VALUES($1,$2,$3,$4,$5,$6)',
            [
              id,
              c.tenantId,
              invitation.membershipId,
              permission,
              scopeId,
              effect,
            ],
          );
          return id;
        };
        for (const permission of [
          "purchases.view",
          "purchases.create",
          "purchases.edit",
          "purchases.costView",
        ])
          await grant(permission, own);
        for (const permission of [
          "suppliers.view",
          "supplierOffers.view",
          "materials.view",
        ])
          await grant(permission, legal);
        const n = await contextFor(h, f.db, f.source);
        assert.equal(n.isMaster, false);
        const created = await request(
          "purchase-orders",
          "POST",
          createBody(randomUUID(), [offerLine(linkA, offerA, "2")]),
          h,
        );
        assert.equal(created.status, 200);
        const nd = () =>
          request("purchase-orders/" + created.body.id, "GET", undefined, h);
        assert.equal(
          (await request("purchase-orders/" + orderA, "GET", undefined, h))
            .status,
          404,
          "OWN cannot read another actor order",
        );
        const ownCost = await grant("materials.costView", own);
        assert(
          !("variantUsdCost" in (await nd()).body.lines[0]),
          "OWN cost does not match another actor material",
        );
        await admin.query('DELETE FROM "UserPermissionOverride" WHERE id=$1', [
          ownCost,
        ]);
        const legalCost = await grant("materials.costView", legal);
        assert.equal((await nd()).body.lines[0].variantUsdCost, "4");
        await admin.query('DELETE FROM "UserPermissionOverride" WHERE id=$1', [
          legalCost,
        ]);
        const deny = await grant("materials.costView", legal, "DENY");
        const d = await nd();
        assert.equal(d.status, 200);
        assert.equal(d.body.lines[0].originalUnitPrice, "15.2");
        assert(!JSON.stringify(d.body).includes("variantUsdCost"));
        await admin.query('DELETE FROM "UserPermissionOverride" WHERE id=$1', [
          deny,
        ]);
        await admin.query('UPDATE "Material" SET "activityId"=$1 WHERE id=$2', [
          ads,
          material.body.id,
        ]);
        const actCost = await grant("materials.costView", activityScope);
        assert.equal((await nd()).body.lines[0].variantUsdCost, "4");
        // Replace the single override for this permission/scope.
        await admin.query(
          "UPDATE \"UserPermissionOverride\" SET effect='DENY' WHERE id=$1",
          [actCost],
        );
        assert(!("variantUsdCost" in (await nd()).body.lines[0]));
        await admin.query('DELETE FROM "UserPermissionOverride" WHERE id=$1', [
          actCost,
        ]);
        // Switch purchase grants from OWN to activity and check selected-context boundaries.
        await admin.query(
          'UPDATE "UserPermissionOverride" SET "scopeId"=$1 WHERE "membershipId"=$2 AND "permissionId" LIKE \'purchases.%\'',
          [activityScope, invitation.membershipId],
        );
        const activityOrder = await request(
          "purchase-orders",
          "POST",
          {
            ...createBody(randomUUID(), [offerLine(linkA, offerA, "2")]),
            activityId: ads,
          },
          h,
        );
        assert.equal(
          activityOrder.status,
          200,
          "company-wide supplier link usable in an authorized activity",
        );
        assert.equal(
          (
            await request(
              "purchase-orders/" + created.body.id,
              "GET",
              undefined,
              h,
            )
          ).status,
          404,
        );
        const wrong = await cloudRequest(
          new Request(
            "http://127.0.0.1:3000/api/cloud/workspace/purchase-orders/" +
              activityOrder.body.id +
              "?company=" +
              scope.legalEntityId +
              "&activity=" +
              other,
            { headers: h },
          ),
          f.db,
          f.source,
        );
        assert.equal(wrong.status, 404);
        const deniedCreate = await request(
          "purchase-orders",
          "POST",
          {
            ...createBody(randomUUID(), [offerLine(linkA, offerA, "2")]),
            activityId: other,
          },
          h,
        );
        assert.equal(deniedCreate.status, 403);
        await admin.query(
          'UPDATE "Material" SET "activityId"=NULL WHERE id=$1',
          [material.body.id],
        );
      },
    );

    // Codex F01-F10 regression cases: independent physical-unit references.
    const draft = async (lines = [offerLine(linkA, offerA, "2")]) => {
      const r = await request(
        "purchase-orders",
        "POST",
        createBody(randomUUID(), lines),
      );
      assert.equal(r.status, 200);
      return r.body.id as string;
    };
    const detailLine = async (orderId: string) =>
      (await detailFor(orderId)).body.lines[0];
    const rawClone = async (orderId: string) => {
      const l = await scoped(
        c,
        (tx) => tx.purchaseOrderLine.findFirstOrThrow({ where: { orderId } }),
        f.db,
        scope.legalEntityId,
      );
      const { id: unused, ...data } = l;
      void unused;
      return {
        ...data,
        id: randomUUID(),
        lineNo: 2,
        conversionSnapshot:
          l.conversionSnapshot as import("../../src/generated/prisma/client").Prisma.InputJsonObject,
        priceSnapshot:
          l.priceSnapshot as import("../../src/generated/prisma/client").Prisma.InputJsonObject,
      };
    };
    const rejectRuntime = async (
      data: Awaited<ReturnType<typeof rawClone>>,
    ) => {
      await assert.rejects(
        scoped(
          c,
          (tx) => tx.purchaseOrderLine.create({ data }),
          f.db,
          scope.legalEntityId,
        ),
      );
    };
    await check(
      "F02: metre and sheet totals use purchase price denominator; offer units and tiers enforced",
      async () => {
        const id = await draft();
        const l = await detailLine(id);
        assert.equal(l.orderedBaseQty, "3.04");
        assert.equal(l.lineTotalUsd, "30.400000000");
        const D = (await import("decimal.js")).default.clone({ precision: 40 });
        assert(new D(l.lineTotalUsd).eq(new D("2").mul("15.20")));
        const wrong = await request(
          "purchase-orders",
          "POST",
          createBody(randomUUID(), [
            { ...offerLine(linkA, offerA, "2"), purchaseUnit: "square_meter" },
          ]),
        );
        assert.equal(wrong.status, 422);
        assert.equal(
          (
            await request(
              "purchase-orders",
              "POST",
              createBody(randomUUID(), [offerLine(linkA, offerA, "0.5")]),
            )
          ).status,
          422,
        );
      },
    );

    await check(
      "F02: historical TRY offer keeps its dated TCMB snapshot without a current rate fetch",
      async () => {
        const { supplierRequest } =
          await import("../../src/server/cloud/business/suppliers");
        const { supplierBusinessDate } =
          await import("../../src/lib/cloud/supplier-date");
        const yesterday = supplierBusinessDate(new Date(Date.now() - 86400000));
        const offer = (await supplierRequest(
          f.headers(),
          ["supplier-offers"],
          "POST",
          {
            ...scope,
            supplierMaterialId: linkA,
            idempotencyKey: randomUUID(),
            originalCurrency: "TRY",
            originalUnitPrice: "76",
            purchaseUnit: "linear_meter",
            minQty: "1",
            maxQty: null,
            offeredOn: yesterday,
            validFrom: yesterday,
            validUntil: null,
            supplierReference: "Frozen TCMB",
            notes: "Synthetic",
          },
          query,
          f.db,
          f.source,
          async () => ({
            value: 50,
            source: "tcmb",
            publishedAt: yesterday,
            fetchedAt: new Date().toISOString(),
          }),
        )) as { id: string };
        const fetcher = globalThis.fetch;
        try {
          globalThis.fetch = async () => {
            throw Error("Unexpected current TCMB fetch");
          };
          const id = await draft([offerLine(linkA, offer.id, "2")]),
            l = await detailLine(id);
          assert.equal(l.lineTotalUsd, "3.040000000");
          assert.equal(l.fxSnapshot.publishedAt, yesterday);
          assert.equal(l.fxSnapshot.usdTry, "50.000000");
        } finally {
          globalThis.fetch = fetcher;
        }
      },
    );
    await check(
      "parallel distinct-key creates allocate different order numbers",
      async () => {
        const made = await Promise.all([draft(), draft(), draft()]);
        assert.equal(new Set(made).size, 3);
        const details = await Promise.all(made.map(detailFor));
        assert.equal(new Set(details.map((r) => r.body.businessNo)).size, 3);
      },
    );

    await check(
      "F04: non-owner SQL rejects wrong variant, offer link, empty and inconsistent snapshots",
      async () => {
        const id = await draft(),
          base = await rawClone(id);
        await rejectRuntime({ ...base, variantId: v137.id });
        await rejectRuntime({ ...base, offerVersionId: offerB });
        await rejectRuntime({ ...base, conversionSnapshot: {} });
        await rejectRuntime({ ...base, priceSnapshot: {} });
        await rejectRuntime({
          ...base,
          priceSnapshot: { ...base.priceSnapshot, lineTotalUsd: "999" },
        });
        await rejectRuntime({
          ...base,
          orderedBaseQty: new (
            await import("../../src/generated/prisma/client")
          ).Prisma.Decimal("1"),
        });
        const valid = await scoped(
          c,
          (tx) => tx.purchaseOrderLine.create({ data: base }),
          f.db,
          scope.legalEntityId,
        );
        assert.equal(valid.variantId, v152.id);
        await scoped(
          c,
          (tx) => tx.purchaseOrderLine.delete({ where: { id: valid.id } }),
          f.db,
          scope.legalEntityId,
        );
      },
    );
    await check(
      "F03: real two-connection delete/approve and insert/approve serialize; empty order blocked",
      async () => {
        const id = await draft();
        let ready!: () => void, release!: () => void;
        const entered = new Promise<void>((r) => (ready = r)),
          gate = new Promise<void>((r) => (release = r));
        const deleting = scoped(
          c,
          async (tx) => {
            await tx.purchaseOrderLine.deleteMany({ where: { orderId: id } });
            ready();
            await gate;
          },
          f.db,
          scope.legalEntityId,
        );
        await entered;
        const approval = request("purchase-orders/" + id + "/approve", "POST", {
          ...scope,
          version: 1,
        });
        try {
          // Observe the actual runtime backend waiting on our parent lock.
          let waiting = false;
          for (let i = 0; i < 100; i++) {
            const r = await admin.query(
              "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='pusula_test_runtime' AND wait_event_type='Lock') AS waiting",
            );
            if (r.rows[0].waiting) {
              waiting = true;
              break;
            }
            await new Promise((r) => setTimeout(r, 10));
          }
          assert(waiting, "approval must wait for line transaction");
        } finally {
          release();
          await deleting;
        }
        assert.equal((await approval).status, 409);
        const empty = await detailFor(id);
        assert.equal(empty.body.status, "DRAFT");
        assert.equal(empty.body.lineCount, 0);
        await assert.rejects(
          scoped(
            c,
            (tx) =>
              tx.purchaseOrder.update({
                where: { id },
                data: {
                  status: "APPROVED",
                  approvedById: c.userId,
                  approvedAt: new Date(),
                  version: { increment: 1 },
                },
              }),
            f.db,
            scope.legalEntityId,
          ),
        );
        const insertId = await draft(),
          data = await rawClone(insertId);
        let unlock!: () => void, notify!: () => void;
        const opened = new Promise<void>((r) => (notify = r)),
          hold = new Promise<void>((r) => (unlock = r));
        const inserting = scoped(
          c,
          async (tx) => {
            await tx.purchaseOrderLine.create({ data });
            notify();
            await hold;
          },
          f.db,
          scope.legalEntityId,
        );
        await opened;
        const approveInsert = request(
          "purchase-orders/" + insertId + "/approve",
          "POST",
          { ...scope, version: 1 },
        );
        unlock();
        await inserting;
        assert.equal((await approveInsert).status, 200);
        assert.equal((await detailFor(insertId)).body.lineCount, 2);
        await rejectRuntime({ ...data, id: randomUUID(), lineNo: 3 });
        const parallelId = await draft();
        const approved = await Promise.all([
          request("purchase-orders/" + parallelId + "/approve", "POST", {
            ...scope,
            version: 1,
          }),
          request("purchase-orders/" + parallelId + "/approve", "POST", {
            ...scope,
            version: 1,
          }),
        ]);
        assert.deepEqual(approved.map((r) => r.status).sort(), [200, 409]);
      },
    );
    await check(
      "F05: draft cancel and approved cancel preserve the correct approval history",
      async () => {
        const id = await draft();
        assert.equal(
          (
            await request("purchase-orders/" + id + "/cancel", "POST", {
              ...scope,
              version: 1,
            })
          ).status,
          200,
        );
        const d = await detailFor(id);
        assert.equal(d.body.status, "CANCELLED");
        assert.equal(d.body.approvedAt, null);
        assert.equal(
          (
            await request("purchase-orders/" + id + "/approve", "POST", {
              ...scope,
              version: 2,
            })
          ).status,
          409,
        );
      },
    );
    await check(
      "F06: login MFA without recent step-up cannot approve",
      async () => {
        const id = await draft();
        const session = await f.source.db.authSession.findUniqueOrThrow({
          where: { id: c.sessionId },
        });
        try {
          await f.source.db.authSession.update({
            where: { id: c.sessionId },
            data: { stepUpAt: null },
          });
          const denied = await request(
            "purchase-orders/" + id + "/approve",
            "POST",
            { ...scope, version: 1 },
          );
          assert.equal(denied.status, 403);
          assert.equal(denied.body.error, "STEP_UP_REQUIRED");
        } finally {
          await f.source.db.authSession.update({
            where: { id: c.sessionId },
            data: { stepUpAt: session.stepUpAt },
          });
        }
        assert.equal(
          (
            await request("purchase-orders/" + id + "/approve", "POST", {
              ...scope,
              version: 1,
            })
          ).status,
          200,
        );
      },
    );
    await check(
      "F07: edit DENY permits initial create but forbids later inserts and PATCH",
      async () => {
        const sid = randomUUID(),
          oid = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'LEGAL_ENTITY\',$3)',
          [sid, c.tenantId, scope.legalEntityId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId","scopeId",effect) VALUES($1,$2,$3,\'purchases.edit\',$4,\'DENY\')',
          [oid, c.tenantId, c.membershipId, sid],
        );
        try {
          const id = await draft();
          assert.equal(
            (
              await request("purchase-orders/" + id, "PATCH", {
                ...scope,
                version: 1,
                lines: [offerLine(linkA, offerA, "3")],
              })
            ).status,
            403,
          );
          await rejectRuntime(await rawClone(id));
        } finally {
          await admin.query(
            'DELETE FROM "UserPermissionOverride" WHERE id=$1',
            [oid],
          );
        }
      },
    );
    await check(
      "F08: redacted manual line retains price server-side and rejects injected preserve fields",
      async () => {
        const id = (
          await request(
            "purchase-orders",
            "POST",
            createBody(randomUUID(), [manualLine(linkA, "2", "USD", "5")]),
          )
        ).body.id;
        const line = await detailLine(id),
          sid = randomUUID(),
          oid = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'LEGAL_ENTITY\',$3)',
          [sid, c.tenantId, scope.legalEntityId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId","scopeId",effect) VALUES($1,$2,$3,\'purchases.costView\',$4,\'DENY\')',
          [oid, c.tenantId, c.membershipId, sid],
        );
        try {
          assert(!("originalUnitPrice" in (await detailLine(id))));
          assert.equal(
            (
              await request("purchase-orders/" + id, "PATCH", {
                ...scope,
                version: 1,
                lines: [{ preserveLineId: line.id, expectedDate: null }],
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await request("purchase-orders/" + id, "PATCH", {
                ...scope,
                version: 2,
                lines: [{ preserveLineId: line.id, manualUnitPrice: "1" }],
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request("purchase-orders/" + id, "PATCH", {
                ...scope,
                version: 2,
                lines: [{ preserveLineId: (await detailLine(orderB)).id }],
              })
            ).status,
            404,
          );
        } finally {
          await admin.query(
            'DELETE FROM "UserPermissionOverride" WHERE id=$1',
            [oid],
          );
        }
        assert.equal((await detailLine(id)).originalUnitPrice, "5");
        assert.equal((await detailLine(id)).lineTotalUsd, "10.000000000");
      },
    );
    await check(
      "F09: nonrepresentable base quantities rejected atomically, no rounded persisted row",
      async () => {
        const count = (await request("purchase-orders")).body.length;
        assert.equal(
          (
            await request(
              "purchase-orders",
              "POST",
              createBody(randomUUID(), [
                offerLine(linkA, offerA, "1.000000001"),
              ]),
            )
          ).status,
          422,
        );
        assert.equal((await request("purchase-orders")).body.length, count);
      },
    );
    await check(
      "F10: missing manual price returns input 400, not service 503",
      async () => {
        const r = await request(
          "purchase-orders",
          "POST",
          createBody(randomUUID(), [
            {
              ...manualLine(linkA, "1", "USD", "2"),
              manualUnitPrice: null,
            } as unknown as OrderLine,
          ]),
        );
        assert.equal(r.status, 400);
        assert.equal(r.body.error, "INVALID_INPUT");
      },
    );

    await check(
      "inactive supplier blocks new orders; offer flow untouched",
      async () => {
        const current = await request(`suppliers/${supplierId}`);
        assert.equal(current.status, 200);
        const { id: unused, ...fields } = current.body;
        void unused;
        assert.equal(
          (
            await request(`suppliers/${supplierId}`, "PATCH", {
              ...scope,
              ...fields,
              active: false,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("purchase-orders", "POST", {
              ...createBody(randomUUID(), [offerLine(linkA, offerA, "1")]),
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await request(`suppliers/${supplierId}/materials`, "POST", {
              ...scope,
              variantId: v137.id,
              idempotencyKey: randomUUID(),
              supplierSku: "PO-VINYL-BAD",
              purchaseUnit: "piece",
              minOrderQty: "1",
              leadTimeDays: 1,
            })
          ).status,
          422,
        );
        assert.equal((await detailFor(orderA)).status, 200);
      },
    );

    await check(
      "material USD costs, price history and quote/sale snapshots unchanged; backup stays failed-closed",
      async () => {
        assert.equal(await digest(), before);
        assert.equal(expectedTables.length, 35);
        assert.equal(expectedForcedTables.length, 21);
        assert(!expectedTables.includes("PurchaseOrder"));
        assert(!expectedForcedTables.includes("PurchaseOrder"));
        const actual = (
          await admin.query(
            `SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`,
          )
        ).rows[0].n;
        assert.equal(
          actual,
          process.env.PUSULA_EXPENSE_FIXTURE === "1"
            ? 56
            : process.env.PUSULA_TREASURY_FIXTURE === "1"
              ? 55
              : process.env.PUSULA_ACCOUNTING_FIXTURE === "1"
                ? 50
                : process.env.PUSULA_STOCK_FIXTURE === "1"
                  ? 47
                  : 40,
        );
      },
    );

    console.log(
      `V4.3a: ${checks}/${checks} synthetic local database/API checks passed.`,
    );
  } finally {
    await f.close();
    await admin.end();
  }
}
main().catch((e) => {
  console.error(
    "V4.3a synthetic verification failed; payloads and credentials suppressed.",
    e instanceof Error ? e.name : "UNKNOWN",
  );
  if (e instanceof Error) {
    const frames = (e.stack ?? "")
      .split("\n")
      .filter((line) => /^\s+at .*\.ts:\d+/.test(line))
      .slice(0, 2);
    if (frames.length) console.error(JSON.stringify({ frames }));
  }
  process.exitCode = 1;
});
