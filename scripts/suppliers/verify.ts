import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { masterFixture } from "../auth/master-fixture";
import { cloudRequest } from "../../src/server/cloud/handler";
import { supplierRequest } from "../../src/server/cloud/business/suppliers";
import { contextFor, scoped } from "../../src/server/authorization/context";
import { expectedTables, expectedForcedTables } from "../backup/postgres";
import { provisionIdentity, authRequest } from "../../src/server/auth/core";

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
    const material = await request("materials", "POST", {
      ...scope,
      idempotencyKey: randomUUID(),
      name: "V42 Fictional Vinyl",
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
    const variant = variants.find((v) => v.widthCm.toString() === "152")!;
    const digest = async () =>
      (
        await admin.query(
          `SELECT md5(coalesce(string_agg(rowval,'|' ORDER BY rowval),'')) AS hash FROM (SELECT to_jsonb(v)::text AS rowval FROM "MaterialVariant" v WHERE v."tenantId"=$1 UNION ALL SELECT to_jsonb(h)::text FROM "MaterialPriceHistory" h WHERE h."tenantId"=$1 UNION ALL SELECT to_jsonb(q)::text FROM "CloudQuote" q WHERE q."tenantId"=$1 UNION ALL SELECT to_jsonb(s)::text FROM "CloudSale" s WHERE s."tenantId"=$1 UNION ALL SELECT to_jsonb(l)::text FROM "CloudSaleLine" l WHERE l."tenantId"=$1) x`,
          [c.tenantId],
        )
      ).rows[0].hash;
    const before = await digest();
    const data = {
      ...scope,
      idempotencyKey: randomUUID(),
      name: "V42 Fictional Supplier A",
      tradeName: "Imaginary A Ltd",
      defaultCurrency: "USD",
      leadTimeDays: 3,
    };
    let supplierA = "",
      supplierB = "",
      linkA = "",
      linkB = "",
      oldOffer = "",
      newestOffer = "";
    const bodyLink = {
      ...scope,
      variantId: variant.id,
      idempotencyKey: randomUUID(),
      supplierSku: "VINYL-152",
      purchaseUnit: "linear_meter",
      minOrderQty: "1",
      leadTimeDays: 3,
    };
    const today = new Date().toISOString().slice(0, 10);
    const offer = (link: string, price: string, currency = "USD") => ({
      ...scope,
      supplierMaterialId: link,
      idempotencyKey: randomUUID(),
      originalCurrency: currency,
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
    await check(
      "create supplier and same-key replay; conflicting payload rejected",
      async () => {
        const a = await request("suppliers", "POST", data);
        assert.equal(a.status, 200);
        supplierA = a.body.id;
        assert.equal(
          (await request("suppliers", "POST", data)).body.id,
          supplierA,
        );
        assert.equal(
          (await request("suppliers", "POST", { ...data, name: "Different" }))
            .status,
          409,
        );
        const b = await request("suppliers", "POST", {
          ...data,
          name: "V42 Fictional Supplier B",
          idempotencyKey: randomUUID(),
        });
        assert.equal(b.status, 200);
        supplierB = b.body.id;
      },
    );
    await check(
      "two suppliers per variant; multiple variants per supplier; link retry",
      async () => {
        const a = await request(
          `suppliers/${supplierA}/materials`,
          "POST",
          bodyLink,
        );
        assert.equal(a.status, 200);
        linkA = a.body.id;
        assert.equal(
          (await request(`suppliers/${supplierA}/materials`, "POST", bodyLink))
            .body.id,
          linkA,
        );
        const b = await request(`suppliers/${supplierB}/materials`, "POST", {
          ...bodyLink,
          idempotencyKey: randomUUID(),
        });
        assert.equal(b.status, 200);
        linkB = b.body.id;
        assert.equal(
          (
            await request(`suppliers/${supplierA}/materials`, "POST", {
              ...bodyLink,
              variantId: variants.find((v) => v.id !== variant.id)!.id,
              idempotencyKey: randomUUID(),
            })
          ).status,
          200,
        );
        assert.equal(
          (await request(`suppliers/${supplierA}/materials`)).body.length,
          2,
        );
      },
    );
    await check(
      "reject undefined mass-volume conversion and invalid dates",
      async () => {
        const r = await request("supplier-offers", "POST", {
          ...offer(linkA, "10"),
          purchaseUnit: "kilogram",
        });
        assert.equal(r.status, 422);
        assert.equal(
          (
            await request("supplier-offers", "POST", {
              ...offer(linkA, "10"),
              validUntil: today,
            })
          ).status,
          400,
        );
      },
    );
    await check(
      "immutable revisions; concurrent retry and unique revision allocation",
      async () => {
        const first = await request(
          "supplier-offers",
          "POST",
          offer(linkA, "15.2"),
        );
        assert.equal(first.status, 200);
        oldOffer = first.body.id;
        const b = offer(linkA, "30.4");
        const replay = await Promise.all([
          request("supplier-offers", "POST", b),
          request("supplier-offers", "POST", b),
        ]);
        assert(replay.every((r) => r.status === 200));
        assert.equal(replay[0].body.id, replay[1].body.id);
        newestOffer = replay[0].body.id;
        assert.equal(
          (
            await request("supplier-offers", "POST", {
              ...b,
              originalUnitPrice: "40",
            })
          ).status,
          409,
        );
        await assert.rejects(
          admin.query(
            'UPDATE "SupplierOfferVersion" SET "originalUnitPrice"=1 WHERE id=$1',
            [oldOffer],
          ),
          (e: unknown) => (e as { code: string }).code === "23514",
        );
        await assert.rejects(
          admin.query('DELETE FROM "SupplierOfferVersion" WHERE id=$1', [
            oldOffer,
          ]),
          (e: unknown) => (e as { code: string }).code === "23514",
        );
        const h = await request(`supplier-offers?link=${linkA}&history=1`);
        assert.equal(h.status, 200);
        assert.equal(h.body.length, 2);
        assert.equal(h.body[0].revision, 2);
      },
    );
    await check(
      "dated verified TRY conversion; EUR/GBP no fabricated USD",
      async () => {
        const rate = async () => ({
          value: 50,
          source: "tcmb" as const,
          publishedAt: today,
          fetchedAt: new Date().toISOString(),
        });
        await supplierRequest(
          f.headers(),
          ["supplier-offers"],
          "POST",
          { ...offer(linkB, "760", "TRY"), minQty: "2" },
          query,
          f.db,
          f.source,
          rate,
        );
        for (const currency of ["EUR", "GBP"])
          assert.equal(
            (
              await request(
                "supplier-offers",
                "POST",
                offer(linkB, "1", currency),
              )
            ).status,
            200,
          );
        const h = await request(`supplier-offers?link=${linkB}&history=1`);
        assert(
          h.body.some(
            (r: { originalCurrency: string; normalizedUsdUnitPrice: string }) =>
              r.originalCurrency === "TRY" && r.normalizedUsdUnitPrice === "10",
          ),
        );
        for (const r of h.body.filter((r: { originalCurrency: string }) =>
          ["EUR", "GBP"].includes(r.originalCurrency),
        ))
          assert.equal(r.normalizedUsdUnitPrice, null);
      },
    );
    await check(
      "comparison applies conversion, active tier and effective revision",
      async () => {
        const r = await request(
          `supplier-comparison?variant=${variant.id}&quantity=15.2&asOf=${today}`,
        );
        assert.equal(r.status, 200);
        assert(r.body.rows.every((r: { id: string }) => r.id !== oldOffer));
        assert(
          r.body.rows.some(
            (r: { comparisonReason: string }) =>
              r.comparisonReason === "FX_UNAVAILABLE",
          ),
        );
        assert.equal(r.body.rows[0].normalizedUsdUnitPrice, "10");
        assert.equal(r.body.rows[0].originalCurrency, "TRY");
        const small = await request(
          `supplier-comparison?variant=${variant.id}&quantity=1&asOf=${today}`,
        );
        assert(
          small.body.rows.every((r: { comparable: boolean }) => !r.comparable),
        );
      },
    );
    await check(
      "expired prices explicit; expired replacement cannot revive old price",
      async () => {
        const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10),
          old = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
        assert.equal(
          (
            await request("supplier-offers", "POST", {
              ...offer(linkA, "1"),
              validFrom: old,
              validUntil: y,
            })
          ).status,
          200,
        );
        const r = await request(
          `supplier-comparison?variant=${variant.id}&quantity=15.2&asOf=${today}`,
        );
        assert(!r.body.rows.some((r: { id: string }) => r.id === newestOffer));
        assert(
          r.body.rows.some(
            (r: { comparisonReason: string }) =>
              r.comparisonReason === "EXPIRED",
          ),
        );
      },
    );
    await check(
      "explicit cost DENY redacts every price and blocks comparison/create",
      async () => {
        const scopeId = randomUUID(),
          override = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'LEGAL_ENTITY\',$3)',
          [scopeId, c.tenantId, scope.legalEntityId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId","scopeId",effect) VALUES($1,$2,$3,\'supplierOffers.costView\',$4,\'DENY\')',
          [override, c.tenantId, c.membershipId, scopeId],
        );
        try {
          const r = await request(`supplier-offers?link=${linkA}&history=1`);
          assert.equal(r.status, 200);
          assert(
            !/originalUnitPrice|normalizedUsd|fxSnapshot|conversionSnapshot|supplierReference|notes/.test(
              JSON.stringify(r.body),
            ),
          );
          assert.equal(
            (
              await request(
                `supplier-comparison?variant=${variant.id}&quantity=10`,
              )
            ).status,
            403,
          );
          assert.equal(
            (await request("supplier-offers", "POST", offer(linkA, "1")))
              .status,
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
      "revoked supplier permission denies next request and replay",
      async () => {
        const scopeId = randomUUID(),
          override = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'LEGAL_ENTITY\',$3)',
          [scopeId, c.tenantId, scope.legalEntityId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId","scopeId",effect) VALUES($1,$2,$3,\'suppliers.view\',$4,\'DENY\')',
          [override, c.tenantId, c.membershipId, scopeId],
        );
        try {
          assert.equal((await request(`suppliers/${supplierA}`)).status, 404);
          assert.equal((await request("suppliers", "POST", data)).status, 403);
        } finally {
          await admin.query(
            'DELETE FROM "UserPermissionOverride" WHERE id=$1',
            [override],
          );
        }
      },
    );
    await check(
      "non-owner runtime RLS: foreign tenant, foreign company, no user",
      async () => {
        for (const [tenant, entity, user] of [
          [randomUUID(), scope.legalEntityId, c.userId],
          [c.tenantId, randomUUID(), c.userId],
          [c.tenantId, scope.legalEntityId, ""],
        ]) {
          const rows = await scoped(
            { userId: user, tenantId: tenant },
            (tx) => tx.supplier.findMany(),
            f.db,
            entity,
          );
          assert.equal(rows.length, 0);
        }
        await assert.rejects(
          scoped(
            c,
            (tx) =>
              tx.supplierMaterial.create({
                data: {
                  tenantId: c.tenantId,
                  legalEntityId: scope.legalEntityId,
                  activityId: null,
                  createdById: c.userId,
                  idempotencyKey: randomUUID(),
                  payloadHash: "a".repeat(64),
                  supplierId: supplierA,
                  variantId: randomUUID(),
                  supplierSku: "bad",
                  purchaseUnit: "piece",
                  minOrderQty: 1,
                  leadTimeDays: 0,
                },
              }),
            f.db,
            scope.legalEntityId,
          ),
        );
      },
    );
    await check(
      "restricted non-master API cannot see another legal entity",
      async () => {
        const password = "Synthetic-" + randomUUID();
        const user = await provisionIdentity(() =>
          f.source.auth.api.signUpEmail({
            body: {
              email: `reader-${randomUUID()}@example.invalid`,
              password,
              name: "Fictional Reader",
            },
          }),
        );
        const membership = randomUUID(),
          scopeId = randomUUID(),
          role = "V42_" + randomUUID();
        await admin.query(
          "INSERT INTO \"Role\"(id,name) VALUES($1,'V42 Reader')",
          [role],
        );
        for (const p of [
          "suppliers.view",
          "materials.view",
          "supplierOffers.view",
        ])
          await admin.query(
            'INSERT INTO "RolePermission"("roleId","permissionId") VALUES($1,$2)',
            [role, p],
          );
        await admin.query(
          'INSERT INTO "Membership"(id,"tenantId","userId") VALUES($1,$2,$3)',
          [membership, c.tenantId, user.user.id],
        );
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'LEGAL_ENTITY\',$3)',
          [scopeId, c.tenantId, scope.legalEntityId],
        );
        await admin.query(
          'INSERT INTO "RoleAssignment"(id,"tenantId","membershipId","roleId","scopeId") VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), c.tenantId, membership, role, scopeId],
        );
        const login = await authRequest(
          new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "http://127.0.0.1:3000",
            },
            body: JSON.stringify({ email: user.user.email, password }),
          }),
          f.source,
        );
        assert.equal(login.status, 200);
        const h = new Headers({
          Origin: "http://127.0.0.1:3000",
          "Content-Type": "application/json",
          cookie: login.headers
            .getSetCookie()
            .map((s) => s.split(";")[0])
            .join("; "),
        });
        assert.equal(
          (await request(`suppliers/${supplierA}`, "GET", undefined, h)).status,
          200,
        );
        const foreign = await admin.query(
          'INSERT INTO "LegalEntity"(id,"tenantId",name) VALUES($1,$2,\'Other V42 entity\') RETURNING id',
          [randomUUID(), c.tenantId],
        );
        const r = await cloudRequest(
          new Request(
            `http://127.0.0.1:3000/api/cloud/workspace/suppliers/${supplierA}?company=${foreign.rows[0].id}`,
            { headers: h },
          ),
          f.db,
          f.source,
        );
        assert.equal(r.status, 404);
        assert.equal(
          (
            await request(
              "suppliers",
              "POST",
              { ...data, idempotencyKey: randomUUID() },
              h,
            )
          ).status,
          403,
        );
      },
    );
    await check(
      "real foreign-tenant records and composite FK references stay isolated",
      async () => {
        const tenant = randomUUID(),
          entity = randomUUID(),
          supplier = randomUUID(),
          material = randomUUID(),
          variant = randomUUID();
        await admin.query(
          "INSERT INTO \"Tenant\"(id,name) VALUES($1,'Foreign V42 tenant')",
          [tenant],
        );
        await admin.query(
          'INSERT INTO "LegalEntity"(id,"tenantId",name) VALUES($1,$2,\'Foreign V42 entity\')',
          [entity, tenant],
        );
        await admin.query(
          'INSERT INTO "Material"(id,"tenantId","legalEntityId",name,unit) VALUES($1,$2,$3,\'Foreign V42 material\',\'piece\')',
          [material, tenant, entity],
        );
        await admin.query(
          'INSERT INTO "MaterialVariant"(id,"tenantId","legalEntityId","materialId",name,"widthCm") VALUES($1,$2,$3,$4,\'Foreign variant\',1)',
          [variant, tenant, entity, material],
        );
        await admin.query(
          'INSERT INTO "Supplier"(id,"tenantId","legalEntityId","createdById","idempotencyKey","payloadHash",name,"defaultCurrency","leadTimeDays") VALUES($1,$2,$3,$4,$5,$6,\'Foreign supplier\',\'USD\',1)',
          [supplier, tenant, entity, c.userId, randomUUID(), "a".repeat(64)],
        );
        assert.equal((await request(`suppliers/${supplier}`)).status, 404);
        const foreignRows = await scoped(
          { tenantId: tenant, userId: c.userId },
          (tx) => tx.supplier.findMany(),
          f.db,
          entity,
        );
        assert.equal(foreignRows.length, 0);
        assert.equal(
          (
            await request(`suppliers/${supplierA}/materials`, "POST", {
              ...bodyLink,
              variantId: variant,
              idempotencyKey: randomUUID(),
            })
          ).status,
          404,
        );
        // Parent scope is a real FK, even an owner cannot combine the other tenant's variant.
        await assert.rejects(
          admin.query(
            'INSERT INTO "SupplierMaterial"(id,"tenantId","legalEntityId","createdById","idempotencyKey","payloadHash","supplierId","variantId","supplierSku","purchaseUnit","minOrderQty","leadTimeDays") VALUES($1,$2,$3,$4,$5,$6,$7,$8,\'bad\',\'piece\',1,0)',
            [
              randomUUID(),
              c.tenantId,
              scope.legalEntityId,
              c.userId,
              randomUUID(),
              "a".repeat(64),
              supplierA,
              variant,
            ],
          ),
          (e: unknown) => (e as { code: string }).code === "23503",
        );
      },
    );
    await check(
      "comparison restricts the selected activity without mixing supplier scopes",
      async () => {
        const ads = randomUUID(),
          software = randomUUID();
        for (const activity of [ads, software])
          await admin.query(
            'INSERT INTO "Activity"(id,"tenantId","legalEntityId",name) VALUES($1,$2,$3,$4)',
            [
              activity,
              c.tenantId,
              scope.legalEntityId,
              `V42 ${activity === ads ? "Ads" : "Software"}`,
            ],
          );
        let excludedSupplier = "";
        for (const activityId of [ads, software]) {
          const supplier = await request("suppliers", "POST", {
            ...data,
            activityId,
            idempotencyKey: randomUUID(),
            name: `V42 Activity ${activityId === ads ? "Ads" : "Software"}`,
          });
          assert.equal(supplier.status, 200);
          const link = await request(
            `suppliers/${supplier.body.id}/materials`,
            "POST",
            { ...bodyLink, activityId, idempotencyKey: randomUUID() },
          );
          assert.equal(link.status, 200);
          assert.equal(
            (
              await request("supplier-offers", "POST", {
                ...offer(link.body.id, "15.2"),
                activityId,
              })
            ).status,
            200,
          );
          if (activityId === software) excludedSupplier = supplier.body.id;
        }
        const comparison = await request(
          `supplier-comparison?variant=${variant.id}&activity=${ads}&quantity=15.2&asOf=${today}`,
        );
        assert.equal(comparison.status, 200);
        assert(
          comparison.body.rows.some(
            (r: { supplierName: string }) =>
              r.supplierName === "V42 Activity Ads",
          ),
        );
        assert(
          !comparison.body.rows.some(
            (r: { supplierId: string }) => r.supplierId === excludedSupplier,
          ),
        );
      },
    );
    await check(
      "supplier deactivation, optimistic conflict, preserved history",
      async () => {
        const current = (await request(`suppliers/${supplierA}`)).body;
        const { id: unused, ...fields } = current;
        void unused;
        assert.equal(
          (
            await request(`suppliers/${supplierA}`, "PATCH", {
              ...scope,
              ...fields,
              active: false,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(`suppliers/${supplierA}`, "PATCH", {
              ...scope,
              ...fields,
              active: true,
            })
          ).status,
          409,
        );
        assert.equal(
          (await request("supplier-offers", "POST", offer(linkA, "1"))).status,
          422,
        );
        assert.equal(
          (await request(`supplier-offers?link=${linkA}&history=1`)).status,
          200,
        );
        assert.equal(
          (await request(`suppliers/${supplierA}`, "DELETE", scope)).status,
          404,
        );
      },
    );
    await check(
      "material USD costs and all previous quote/sale snapshots unchanged",
      async () => assert.equal(await digest(), before),
    );
    await check(
      "backup remains fail-closed: new tables and RLS not auto-enrolled",
      async () => {
        assert.equal(expectedTables.length, 35);
        assert.equal(expectedForcedTables.length, 21);
        assert(!expectedTables.includes("Supplier"));
        assert(!expectedTables.includes("PurchaseOrder"));
        const actual = (
          await admin.query(
            `SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`,
          )
        ).rows[0].n;
        assert.equal(actual, process.env.PUSULA_STOCK_FIXTURE === "1" ? 47 : 40);
      },
    );
    console.log(
      `V42: ${checks}/${checks} synthetic local database/API checks passed.`,
    );
  } finally {
    await f.close();
    await admin.end();
  }
}
main().catch(() => {
  console.error(
    "V42 synthetic verification failed; payloads and credentials suppressed.",
  );
  process.exitCode = 1;
});
