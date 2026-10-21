import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import Decimal from "decimal.js";
import { masterFixture } from "../auth/master-fixture";
import { cloudRequest } from "../../src/server/cloud/handler";
import { contextFor } from "../../src/server/authorization/context";
async function main() {
  if (!process.env.PUSULA_LOCAL_FIXTURE) throw Error("LOCAL_ONLY");
  const f = await masterFixture(),
    admin = new Client({
      connectionString: process.env.TEST_DIRECT_DATABASE_URL,
    });
  await admin.connect();
  let n = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    await fn();
    console.log(`PASS ${++n}: ${name}`);
  };
  try {
    const ctx = await contextFor(f.headers(), f.db, f.source),
      boot = await f.source.db.authBootstrap.findFirstOrThrow();
    const scope = { legalEntityId: boot.legalEntityId, activityId: null };
    const legacy: Record<string, { ids: string[]; digest: string }> = {};
    for (const table of [
      "PurchaseOrder",
      "PurchaseOrderLine",
      "MaterialVariant",
      "MaterialPriceHistory",
      "SupplierOfferVersion",
      "CloudQuote",
      "CloudSale",
      "CloudSaleLine",
    ]) {
      const ids = (
        await admin.query('SELECT id FROM public."' + table + '" ORDER BY id')
      ).rows.map((x) => x.id as string);
      const digest = (
        await admin.query(
          'SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),chr(0+32) ORDER BY id),chr(0+32))) digest FROM public."' +
            table +
            '" t WHERE id=ANY($1::uuid[])',
          [ids],
        )
      ).rows[0].digest;
      legacy[table] = { ids, digest };
    }
    const request = async (
      path: string,
      method = "GET",
      body?: object,
      action?: string,
    ) => {
      const r = await cloudRequest(
        new Request(
          "http://127.0.0.1:3000/api/cloud/workspace/" +
            path +
            (method === "GET"
              ? "?company=" +
                scope.legalEntityId +
                (action ? "&action=" + action : "")
              : ""),
          {
            method,
            headers: f.headers(),
            ...(body ? { body: JSON.stringify({ ...scope, ...body }) } : {}),
          },
        ),
        f.db,
        f.source,
      );
      return { status: r.status, body: await r.json() };
    };
    const ok = async (
      path: string,
      method = "GET",
      body?: object,
      action?: string,
    ) => {
      const r = await request(path, method, body, action);
      assert.equal(r.status, 200, JSON.stringify({ path, ...r }));
      return r.body;
    };
    const mat = await ok("materials", "POST", {
      idempotencyKey: randomUUID(),
      name: "Receipt synthetic roll",
      unit: "square_meter",
      roll: true,
      category: "Test",
      margins: { left: 0, right: 0, top: 0, bottom: 0 },
      variants: [{ name: "152", widthCm: 152, usdCost: "4", inStock: false }],
    });
    const variant = (
      await admin.query(
        `SELECT id FROM "MaterialVariant" WHERE "materialId"=$1`,
        [mat.id],
      )
    ).rows[0].id;
    const supplier = await ok("suppliers", "POST", {
      idempotencyKey: randomUUID(),
      name: "Receipt synthetic supplier",
      defaultCurrency: "USD",
      leadTimeDays: 0,
    });
    const link = await ok(`suppliers/${supplier.id}/materials`, "POST", {
      idempotencyKey: randomUUID(),
      variantId: variant,
      supplierSku: "GR152",
      purchaseUnit: "linear_meter",
      minOrderQty: "1",
      leadTimeDays: 0,
    });
    const po = async (
      qty = "2",
      currency = "USD",
      linkId = link.id,
      unit = "linear_meter",
    ) => {
      const r = await ok("purchase-orders", "POST", {
        idempotencyKey: randomUUID(),
        supplierId: supplier.id,
        revisesOrderId: null,
        lines: [
          {
            supplierMaterialId: linkId,
            offerVersionId: null,
            orderedQty: qty,
            purchaseUnit: unit,
            expectedDate: null,
            manualCurrency: currency,
            manualUnitPrice: "15.20",
          },
        ],
      });
      await ok(`purchase-orders/${r.id}/approve`, "POST", { version: 1 });
      const line = (
        await admin.query(
          `SELECT id FROM "PurchaseOrderLine" WHERE "orderId"=$1`,
          [r.id],
        )
      ).rows[0].id;
      return { id: r.id, line };
    };
    const location = await ok("stock/locations", "POST", {
      code: "GRTEST",
      name: "Synthetic warehouse",
    });
    const body = (
      o: { id: string; line: string },
      qty: string,
      rejected = "0",
    ) => ({
      orderId: o.id,
      locationId: location.id,
      receivedAt: new Date().toISOString().slice(0, 10),
      idempotencyKey: randomUUID(),
      sourceRef: "SYNTHETIC",
      lines: [
        {
          orderLineId: o.line,
          lineNo: 1,
          receivedQty: qty,
          rejectedQty: rejected,
          rejectionReason: rejected !== "0" ? "Damaged packaging" : "",
          singlePackage: true,
        },
      ],
    });
    const draft = async (
      o: { id: string; line: string },
      qty: string,
      rejected = "0",
    ) => ok("goods-receipts", "POST", body(o, qty, rejected));
    const post = (id: string) =>
      ok(`goods-receipts/${id}/post`, "POST", { version: 1 });
    const counts = async () =>
      (
        await admin.query(
          `SELECT (SELECT count(*)::int FROM "StockLot") lots,(SELECT count(*)::int FROM "StockMovement") movements,(SELECT count(*)::int FROM "StockPostingBatch") batches,(SELECT coalesce(sum("quantityBase"),0)::text FROM "StockBalance") balance`,
        )
      ).rows[0];
    const o = await po(),
      b = body(o, "1", "0.5");
    let r: { id: string };
    await check(
      "draft zero stock; same-key replay; payload conflict",
      async () => {
        const before = await counts();
        r = await ok("goods-receipts", "POST", b);
        assert.equal((await ok("goods-receipts", "POST", b)).id, r.id);
        assert.equal(
          (
            await request("goods-receipts", "POST", {
              ...b,
              sourceRef: "DIFFERENT",
            })
          ).status,
          409,
        );
        assert.deepEqual(await counts(), before);
      },
    );
    await check(
      "partial received-minus-rejected; physical roll and frozen cost independently verified",
      async () => {
        await post(r!.id);
        const row = (
          await admin.query(
            `SELECT l.*,m."quantityDeltaBase",b."quantityBase" FROM "StockLot" l JOIN "StockMovement" m ON m."lotId"=l.id JOIN "StockBalance" b ON b."lotId"=l.id WHERE l."originReceiptLineId" IN(SELECT id FROM "GoodsReceiptLine" WHERE "receiptId"=$1)`,
            [r!.id],
          )
        ).rows[0];
        assert(new Decimal(row.quantityBase).eq("0.5"));
        assert.equal(row.baseUnit, "linear_meter");
        assert(new Decimal(row.widthCm).eq("152"));
        assert(
          new Decimal(row.quantityBase).mul(row.widthCm).div(100).eq("0.76"),
        );
        assert(
          new Decimal(row.acquisitionSnapshot.lineTotalUsd).eq(
            new Decimal("0.5").mul("15.2"),
          ),
        );
        assert(!("variantUsdCost" in row.acquisitionSnapshot));
        assert.equal(
          (
            await admin.query(
              `SELECT "usdCost"::text FROM "MaterialVariant" WHERE id=$1`,
              [variant],
            )
          ).rows[0].usdCost,
          "4.000000",
        );
      },
    );
    await check("post replay creates no duplicate ledger", async () => {
      const before = await counts();
      await post(r!.id);
      assert.deepEqual(await counts(), before);
    });
    await check(
      "multiple partials complete order; over-receipt rolls back all stock",
      async () => {
        const second = await draft(o, "1.5");
        await post(second.id);
        const over = await draft(o, "0.1");
        const before = await counts();
        assert.equal(
          (
            await request(`goods-receipts/${over.id}/post`, "POST", {
              version: 1,
            })
          ).status,
          409,
        );
        assert.deepEqual(await counts(), before);
        assert.equal(
          (
            await admin.query(`SELECT status FROM "GoodsReceipt" WHERE id=$1`, [
              over.id,
            ])
          ).rows[0].status,
          "DRAFT",
        );
        const sum = (
          await admin.query(
            `SELECT sum(l."receivedQty"-l."rejectedQty")::text n FROM "GoodsReceiptLine" l JOIN "GoodsReceipt" h ON h.id=l."receiptId" WHERE h."orderId"=$1 AND h.status='POSTED'`,
            [o.id],
          )
        ).rows[0].n;
        assert(new Decimal(sum).eq("2"));
      },
    );
    await check(
      "full delivery new order; acquired cost cannot rewrite manual catalog",
      async () => {
        const all = await draft(await po(), "2");
        await post(all.id);
        const row = (
          await admin.query(
            `SELECT l."initialBaseQty"::text,l."acquisitionSnapshot"->>'lineTotalUsd' total FROM "StockLot" l JOIN "GoodsReceiptLine" rl ON rl.id=l."originReceiptLineId" WHERE rl."receiptId"=$1`,
            [all.id],
          )
        ).rows[0];
        assert(new Decimal(row.initialBaseQty).eq(2));
        assert(new Decimal(row.total).eq("30.4"));
      },
    );
    await check("fully rejected delivery creates no usable stock", async () => {
      const reject = await draft(await po(), "1", "1");
      const before = await counts();
      await post(reject.id);
      const after = await counts();
      assert.equal(after.lots, before.lots);
      assert.equal(after.movements, before.movements);
      assert.equal(after.balance, before.balance);
    });
    await check(
      "draft edit stale version; cancel and posted mutation limits",
      async () => {
        const pending = await draft(await po(), "1");
        const detail = await ok(`goods-receipts/${pending.id}`);
        const edit = {
          version: 1,
          receivedAt: detail.receivedAt,
          sourceRef: "edited",
          lines: detail.lines.map(
            (l: {
              orderLineId: string;
              lineNo: number;
              receivedQty: string;
              rejectedQty: string;
              rejectionReason: string;
            }) => ({ ...l, singlePackage: true, id: undefined }),
          ),
        };
        await ok(`goods-receipts/${pending.id}`, "PATCH", edit);
        assert.equal(
          (await request(`goods-receipts/${pending.id}`, "PATCH", edit)).status,
          409,
        );
        await ok(`goods-receipts/${pending.id}/cancel`, "POST", {
          version: 2,
          reason: "Synthetic cancel",
        });
        assert.equal(
          (
            await request(`goods-receipts/${pending.id}/post`, "POST", {
              version: 3,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(`goods-receipts/${r!.id}/cancel`, "POST", {
              version: 2,
              reason: "Not allowed",
            })
          ).status,
          409,
        );
      },
    );
    await check(
      "reversal appends exact negative; preserves receipt, prevents second reversal",
      async () => {
        const rev = await draft(await po(), "1");
        await post(rev.id);
        const before = await counts();
        await ok(`goods-receipts/${rev.id}/reverse`, "POST", {
          version: 2,
          reason: "Synthetic correction",
        });
        const after = await counts();
        assert.equal(after.movements, before.movements + 1);
        assert(new Decimal(before.balance).minus(after.balance).eq(1));
        assert.equal(
          (
            await request(`goods-receipts/${rev.id}/reverse`, "POST", {
              version: 2,
              reason: "Repeat correction",
            })
          ).status,
          409,
        );
        assert.equal((await ok(`goods-receipts/${rev.id}`)).status, "POSTED");
      },
    );
    const runtime = async () => {
      const c = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      await c.connect();
      await c.query("BEGIN");
      await c.query(
        "SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true),set_config('app.legal_entity_id',$3,true)",
        [ctx.userId, ctx.tenantId, scope.legalEntityId],
      );
      return c;
    };
    await check(
      "two actual runtime connections serialize over-delivery at parent lock",
      async () => {
        const secondLocation = await ok("stock/locations", "POST", {
          code: "RACE_SECOND",
          name: "Race second warehouse",
        });
        const race = await po(),
          a = await draft(race, "1.5"),
          b = await ok("goods-receipts", "POST", {
            ...body(race, "1.5"),
            locationId: secondLocation.id,
          }),
          c1 = await runtime(),
          c2 = await runtime();
        try {
          await c1.query("SELECT v43b_command($1,$2::jsonb)", [
            "post",
            JSON.stringify({ ...scope, id: a.id, version: 1 }),
          ]);
          const pid = (await c2.query("SELECT pg_backend_pid() pid")).rows[0]
            .pid;
          const pending = c2
            .query("SELECT v43b_command($1,$2::jsonb)", [
              "post",
              JSON.stringify({ ...scope, id: b.id, version: 1 }),
            ])
            .then(
              () => null,
              (e: { code: string; message: string }) => e,
            );
          await new Promise((resolve) => setTimeout(resolve, 150));
          const waiting = (
            await admin.query(
              "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock') yes",
              [pid],
            )
          ).rows[0].yes;
          assert.equal(waiting, true);
          await c1.query("COMMIT");
          const rejected = await pending;
          assert.equal(rejected?.code, "23514");
          assert.match(rejected?.message ?? "", /OVER_RECEIPT/);
          await c2.query("ROLLBACK");
          assert.equal(
            (
              await admin.query(
                `SELECT status FROM "GoodsReceipt" WHERE id=$1`,
                [b.id],
              )
            ).rows[0].status,
            "DRAFT",
          );
        } finally {
          await c1.query("ROLLBACK").catch(() => {});
          await c2.query("ROLLBACK").catch(() => {});
          await c1.end();
          await c2.end();
        }
      },
    );
    await check(
      "raw runtime cannot INSERT UPDATE DELETE TRUNCATE stock or SET executor role",
      async () => {
        for (const sql of [
          'INSERT INTO "StockBalance" DEFAULT VALUES',
          'UPDATE "StockMovement" SET "quantityDeltaBase"=999',
          'DELETE FROM "StockLot"',
          'TRUNCATE "StockMovement"',
          "SET ROLE pusula_stock_executor",
        ]) {
          const c = await runtime();
          try {
            await assert.rejects(() => c.query(sql));
          } finally {
            await c.query("ROLLBACK");
            await c.end();
          }
        }
      },
    );
    await check(
      "foreign order-line and bad activity rejected; invalid decimal never partially posts",
      async () => {
        const other = await po(),
          b = body(other, "1");
        b.lines[0].orderLineId = o.line;
        assert.equal((await request("goods-receipts", "POST", b)).status, 409);
        assert.notEqual(
          (
            await request("goods-receipts", "POST", {
              ...body(other, "1"),
              activityId: randomUUID(),
            })
          ).status,
          200,
        );
        assert.equal(
          (await request("goods-receipts", "POST", body(other, "0.0000000001")))
            .status,
          400,
        );
      },
    );
    await check(
      "EUR/GBP missing FX stays null in lot; no fabricated USD",
      async () => {
        for (const currency of ["EUR", "GBP"]) {
          const x = await draft(await po("2", currency), "1");
          await post(x.id);
          const row = (
            await admin.query(
              `SELECT l."acquisitionSnapshot" fx FROM "StockLot" l JOIN "GoodsReceiptLine" rl ON rl.id=l."originReceiptLineId" WHERE rl."receiptId"=$1`,
              [x.id],
            )
          ).rows[0];
          assert.equal(row.fx.originalCurrency, currency);
          assert.equal(row.fx.lineTotalUsd, null);
        }
      },
    );
    await check(
      "non-master explicit DENY redacts lot cost while preserving quantity",
      async () => {
        const m = (
          await admin.query(
            `SELECT id FROM "Membership" WHERE "tenantId"=$1 AND "userId"=$2`,
            [ctx.tenantId, ctx.userId],
          )
        ).rows[0];
        const scopeId = (
          await admin.query(
            `SELECT "scopeId" FROM "RoleAssignment" WHERE "membershipId"=$1`,
            [m.id],
          )
        ).rows[0].scopeId;
        await admin.query(
          `UPDATE "Membership" SET "isMaster"=false WHERE id=$1`,
          [m.id],
        );
        const id = randomUUID();
        await admin.query(
          `INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,'receipts.costView','DENY',$4)`,
          [id, ctx.tenantId, m.id, scopeId],
        );
        try {
          const lots = await ok("stock/lots");
          assert(lots.length > 0);
          assert(
            lots.every(
              (l: Record<string, unknown>) => !("acquisitionSnapshot" in l),
            ),
          );
          assert(
            lots.some((l: { balances: unknown[] }) => l.balances.length > 0),
          );
          await admin.query(
            'UPDATE "UserPermissionOverride" SET "permissionId"=$2 WHERE id=$1',
            [id, "materials.costView"],
          );
          const materialDenied = await ok("stock/lots");
          const picker = await ok("receipt-orders");
          assert(
            picker.every((o: { lines: Record<string, unknown>[] }) =>
              o.lines.every(
                (l) =>
                  !("conversionSnapshot" in l) &&
                  !("priceSnapshot" in l) &&
                  !("variantUsdCost" in l),
              ),
            ),
          );
          assert(
            materialDenied.every(
              (l: Record<string, unknown>) => !("acquisitionSnapshot" in l),
            ),
          );
          await admin.query(
            'UPDATE "UserPermissionOverride" SET "permissionId"=$2 WHERE id=$1',
            [id, "receipts.post"],
          );
          const deniedReceipt = await draft(await po(), "1"),
            before = await counts();
          assert.equal(
            (
              await request(
                "goods-receipts/" + deniedReceipt.id + "/post",
                "POST",
                { version: 1 },
              )
            ).status,
            403,
          );
          assert.deepEqual(await counts(), before);
          assert.equal(
            (
              await request(
                "goods-receipts/" + deniedReceipt.id + "/outcome",
                "GET",
                undefined,
                "post",
              )
            ).status,
            403,
          );
        } finally {
          await admin.query(
            `DELETE FROM "UserPermissionOverride" WHERE id=$1`,
            [id],
          );
          await admin.query(
            `UPDATE "Membership" SET "isMaster"=true WHERE id=$1`,
            [m.id],
          );
        }
      },
    );
    await check(
      "MFA step-up required for posting; failed API changes no stock",
      async () => {
        const x = await draft(await po(), "1");
        const session = (
          await admin.query(
            `SELECT id,"stepUpAt" FROM "AuthSession" WHERE id=$1`,
            [ctx.sessionId],
          )
        ).rows[0];
        const before = await counts();
        await admin.query(
          `UPDATE "AuthSession" SET "stepUpAt"=NULL WHERE id=$1`,
          [session.id],
        );
        try {
          assert.equal(
            (
              await request(`goods-receipts/${x.id}/post`, "POST", {
                version: 1,
              })
            ).status,
            403,
          );
          assert.deepEqual(await counts(), before);
        } finally {
          await admin.query(
            `UPDATE "AuthSession" SET "stepUpAt"=$2 WHERE id=$1`,
            [session.id, session.stepUpAt],
          );
        }
      },
    );

    await check(
      "sheet and piece physical counts; fractional sheet rejected",
      async () => {
        for (const unit of ["sheet", "piece"]) {
          const material = await ok("materials", "POST", {
            idempotencyKey: randomUUID(),
            name: "Physical " + unit,
            unit: unit === "sheet" ? "square_meter" : "piece",
            roll: false,
            category: "Test",
            margins: { left: 0, right: 0, top: 0, bottom: 0 },
            variants: [
              {
                name: unit,
                widthCm: 100,
                ...(unit === "sheet" ? { lengthCm: 200 } : {}),
                usdCost: "4",
                inStock: false,
              },
            ],
          });
          const v = (
            await admin.query(
              `SELECT id FROM "MaterialVariant" WHERE "materialId"=$1`,
              [material.id],
            )
          ).rows[0].id;
          const lk = await ok(
            "suppliers/" + supplier.id + "/materials",
            "POST",
            {
              idempotencyKey: randomUUID(),
              variantId: v,
              supplierSku: unit,
              purchaseUnit: unit,
              minOrderQty: "1",
              leadTimeDays: 0,
            },
          );
          const ord = await po("2", "USD", lk.id, unit),
            receipt = await draft(ord, "2");
          await post(receipt.id);
          const lot = (
            await admin.query(
              `SELECT l.* FROM "StockLot" l JOIN "GoodsReceiptLine" rl ON rl.id=l."originReceiptLineId" WHERE rl."receiptId"=$1`,
              [receipt.id],
            )
          ).rows[0];
          assert.equal(lot.baseUnit, unit);
          assert(new Decimal(lot.initialBaseQty).eq(2));
          if (unit === "sheet") {
            assert(
              new Decimal(lot.widthCm)
                .mul(lot.sheetHeightCm)
                .div(10000)
                .mul(lot.initialBaseQty)
                .eq(4),
            );
            const fractional = await draft(
              await po("2", "USD", lk.id, unit),
              "0.5",
            );
            const before = await counts();
            assert.equal(
              (
                await request(
                  "goods-receipts/" + fractional.id + "/post",
                  "POST",
                  { version: 1 },
                )
              ).status,
              422,
            );
            assert.deepEqual(await counts(), before);
          }
        }
      },
    );
    await check(
      "mid-post SQL failure rolls back receipt lot batch balance and audit together",
      async () => {
        const x = await draft(await po(), "1");
        const before = await counts();
        const auditBefore = (
          await admin.query('SELECT count(*)::int n FROM "AuditEvent"')
        ).rows[0].n;
        await admin.query(
          `CREATE FUNCTION fixture_fail_stock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_POST_FAILURE'; END $$;CREATE TRIGGER fixture_fail_stock BEFORE INSERT ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION fixture_fail_stock()`,
        );
        try {
          assert.notEqual(
            (
              await request("goods-receipts/" + x.id + "/post", "POST", {
                version: 1,
              })
            ).status,
            200,
          );
          assert.deepEqual(await counts(), before);
          assert.equal(
            (await admin.query('SELECT count(*)::int n FROM "AuditEvent"'))
              .rows[0].n,
            auditBefore,
          );
          assert.equal((await ok("goods-receipts/" + x.id)).status, "DRAFT");
        } finally {
          await admin.query(
            'DROP TRIGGER fixture_fail_stock ON "StockMovement";DROP FUNCTION fixture_fail_stock()',
          );
        }
      },
    );
    await check(
      "real normal OWN role hides another actor while cumulative limit still includes them",
      async () => {
        const ord = await po(),
          otherUser = randomUUID(),
          member = randomUUID(),
          roleScope = randomUUID();
        await f.source.db.authUser.create({
          data: {
            id: otherUser,
            name: "Synthetic other receiver",
            email: otherUser + "@example.invalid",
            emailVerified: true,
          },
        });
        await admin.query(
          `INSERT INTO "Membership"(id,"tenantId","userId",status,"isMaster") VALUES($1,$2,$3,'ACTIVE',false)`,
          [member, ctx.tenantId, otherUser],
        );
        const old = (
          await admin.query(
            `SELECT * FROM "RoleAssignment" WHERE "membershipId"=$1`,
            [ctx.membershipId],
          )
        ).rows;
        const masterScope = old[0].scopeId;
        await admin.query(
          `INSERT INTO "RoleAssignment"(id,"tenantId","membershipId","roleId","scopeId") VALUES($1,$2,$3,'MASTER',$4)`,
          [randomUUID(), ctx.tenantId, member, masterScope],
        );
        const otherClient = await runtime();
        let otherId: string;
        try {
          await otherClient.query("SELECT set_config('app.user_id',$1,true)", [
            otherUser,
          ]);
          otherId = (
            await otherClient.query("SELECT v43b_command($1,$2::jsonb) id", [
              "create",
              JSON.stringify({ ...scope, ...body(ord, "1.5") }),
            ])
          ).rows[0].id;
          await otherClient.query("SELECT v43b_command($1,$2::jsonb)", [
            "post",
            JSON.stringify({ ...scope, id: otherId, version: 1 }),
          ]);
          await otherClient.query("COMMIT");
        } finally {
          await otherClient.end();
        }
        await admin.query(
          `INSERT INTO "Role"(id,name) VALUES('STOCK_NORMAL','Stock normal')`,
        );
        await admin.query(
          `INSERT INTO "RolePermission"("roleId","permissionId") SELECT 'STOCK_NORMAL',id FROM "Permission"`,
        );
        await admin.query(
          `INSERT INTO "PermissionScope"(id,"tenantId","legalEntityId",kind) VALUES($1,$2,$3,'OWN')`,
          [roleScope, ctx.tenantId, scope.legalEntityId],
        );
        await admin.query(
          `DELETE FROM "RoleAssignment" WHERE "membershipId"=$1`,
          [ctx.membershipId],
        );
        await admin.query(
          `INSERT INTO "RoleAssignment"(id,"tenantId","membershipId","roleId","scopeId") VALUES($1,$2,$3,'STOCK_NORMAL',$4)`,
          [randomUUID(), ctx.tenantId, ctx.membershipId, roleScope],
        );
        await admin.query(
          `UPDATE "Membership" SET "isMaster"=false WHERE id=$1`,
          [ctx.membershipId],
        );
        try {
          assert.equal(
            (await request("goods-receipts/" + otherId!)).status,
            404,
          );
          assert.equal(
            (
              await request(
                "goods-receipts/" + otherId + "/outcome",
                "GET",
                undefined,
                "post",
              )
            ).status,
            404,
          );
          const own = await draft(ord, "1.5");
          assert.equal((await ok("goods-receipts/" + own.id)).status, "DRAFT");
          const before = await counts();
          assert.equal(
            (
              await request("goods-receipts/" + own.id + "/post", "POST", {
                version: 1,
              })
            ).status,
            409,
          );
          assert.deepEqual(await counts(), before);
          const remaining = await draft(ord, "0.5");
          await post(remaining.id);
          // Another actor reverses their hidden receipt; OWN totals must see that reversal.
          const reversing = await runtime();
          try {
            await reversing.query("SELECT set_config('app.user_id',$1,true)", [
              otherUser,
            ]);
            await reversing.query("SELECT v43b_command($1,$2::jsonb)", [
              "reverse",
              JSON.stringify({
                ...scope,
                id: otherId,
                version: 2,
                reason: "Hidden reversal correction",
              }),
            ]);
            await reversing.query("COMMIT");
          } finally {
            await reversing.query("ROLLBACK");
            await reversing.end();
          }
          await post(own.id);
          const picker = await ok("receipt-orders");
          assert(
            new Decimal(
              picker.find((x: { id: string }) => x.id === ord.id).lines[0]
                .acceptedQty,
            ).eq(2),
          );
        } finally {
          await admin.query(
            `DELETE FROM "RoleAssignment" WHERE "membershipId"=$1`,
            [ctx.membershipId],
          );
          for (const a of old)
            await admin.query(
              `INSERT INTO "RoleAssignment"(id,"tenantId","membershipId","roleId","scopeId") VALUES($1,$2,$3,$4,$5)`,
              [a.id, a.tenantId, a.membershipId, a.roleId, a.scopeId],
            );
          await admin.query(
            `UPDATE "Membership" SET "isMaster"=true WHERE id=$1`,
            [ctx.membershipId],
          );
        }
      },
    );
    await check(
      "foreign tenant/company contexts cannot read receipts or post existing source",
      async () => {
        const foreignTenant = (
          await admin.query(`SELECT id FROM "Tenant" WHERE id<>$1 LIMIT 1`, [
            ctx.tenantId,
          ])
        ).rows[0].id;
        const client = await runtime();
        try {
          await client.query("SELECT set_config('app.tenant_id',$1,true)", [
            foreignTenant,
          ]);
          assert.equal(
            (await client.query('SELECT count(*)::int n FROM "GoodsReceipt"'))
              .rows[0].n,
            0,
          );
          await assert.rejects(
            () =>
              client.query("SELECT v43b_receipt_outcome($1,$2)", [
                r!.id,
                "post",
              ]),
            (e: unknown) => (e as { code: string }).code === "42501",
          );
          await client.query("ROLLBACK");
          await client.query("BEGIN");
          await client.query(
            "SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true),set_config('app.legal_entity_id',$3,true)",
            [ctx.userId, foreignTenant, scope.legalEntityId],
          );
          await assert.rejects(() =>
            client.query("SELECT v43b_command($1,$2::jsonb)", [
              "post",
              JSON.stringify({ ...scope, id: r!.id, version: 1 }),
            ]),
          );
        } finally {
          await client.query("ROLLBACK");
          await client.end();
        }
        const foreignEntity = randomUUID();
        await admin.query(
          `INSERT INTO "LegalEntity"(id,"tenantId",name) VALUES($1,$2,'Foreign synthetic company')`,
          [foreignEntity, ctx.tenantId],
        );
        assert.equal(
          (await request("goods-receipts/" + r!.id + "?ignored=1")).status,
          400,
        );
        const response = await cloudRequest(
          new Request(
            "http://127.0.0.1:3000/api/cloud/workspace/goods-receipts/" +
              r!.id +
              "?company=" +
              foreignEntity,
            { headers: f.headers() },
          ),
          f.db,
          f.source,
        );
        assert.equal(response.status, 404);
      },
    );

    await check(
      "ACTIVITY scope normal user sees only the selected activity receipts",
      async () => {
        const activityId = randomUUID();
        await admin.query(
          'INSERT INTO "Activity"(id,"tenantId","legalEntityId",name) VALUES($1,$2,$3,$4)',
          [activityId, ctx.tenantId, scope.legalEntityId, "Receipt activity"],
        );
        const order = await ok("purchase-orders", "POST", {
          activityId,
          idempotencyKey: randomUUID(),
          supplierId: supplier.id,
          revisesOrderId: null,
          lines: [
            {
              supplierMaterialId: link.id,
              offerVersionId: null,
              orderedQty: "2",
              purchaseUnit: "linear_meter",
              expectedDate: null,
              manualCurrency: "USD",
              manualUnitPrice: "15.2",
            },
          ],
        });
        await ok("purchase-orders/" + order.id + "/approve", "POST", {
          activityId,
          version: 1,
        });
        const line = (
          await admin.query(
            'SELECT id FROM "PurchaseOrderLine" WHERE "orderId"=$1',
            [order.id],
          )
        ).rows[0].id;
        const receipt = await ok("goods-receipts", "POST", {
          ...body({ id: order.id, line }, "1"),
          activityId,
        });
        const old = (
          await admin.query(
            'SELECT * FROM "RoleAssignment" WHERE "membershipId"=$1',
            [ctx.membershipId],
          )
        ).rows;
        const sc = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId","legalEntityId","activityId",kind) VALUES($1,$2,$3,$4,$5)',
          [sc, ctx.tenantId, scope.legalEntityId, activityId, "ACTIVITY"],
        );
        await admin.query(
          'DELETE FROM "RoleAssignment" WHERE "membershipId"=$1',
          [ctx.membershipId],
        );
        await admin.query(
          'INSERT INTO "RoleAssignment"(id,"tenantId","membershipId","roleId","scopeId") VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), ctx.tenantId, ctx.membershipId, "STOCK_NORMAL", sc],
        );
        await admin.query(
          'UPDATE "Membership" SET "isMaster"=false WHERE id=$1',
          [ctx.membershipId],
        );
        try {
          const get = async (id?: string) =>
            cloudRequest(
              new Request(
                "http://127.0.0.1:3000/api/cloud/workspace/goods-receipts" +
                  (id ? "/" + id : "") +
                  "?company=" +
                  scope.legalEntityId +
                  "&activity=" +
                  activityId,
                { headers: f.headers() },
              ),
              f.db,
              f.source,
            );
          const response = await get();
          assert.equal(response.status, 200);
          const rows = await response.json();
          assert(rows.some((x: { id: string }) => x.id === receipt.id));
          assert(
            rows.every(
              (x: { activityId: string }) => x.activityId === activityId,
            ),
          );
          assert.equal((await get(r!.id)).status, 404);
        } finally {
          await admin.query(
            'DELETE FROM "RoleAssignment" WHERE "membershipId"=$1',
            [ctx.membershipId],
          );
          for (const a of old)
            await admin.query(
              'INSERT INTO "RoleAssignment"(id,"tenantId","membershipId","roleId","scopeId") VALUES($1,$2,$3,$4,$5)',
              [a.id, a.tenantId, a.membershipId, a.roleId, a.scopeId],
            );
          await admin.query(
            'UPDATE "Membership" SET "isMaster"=true WHERE id=$1',
            [ctx.membershipId],
          );
        }
      },
    );
    await check(
      "TRY acquisition preserves original PO FX snapshot without repricing",
      async () => {
        const order = await po("2", "TRY"),
          receipt = await draft(order, "1");
        await post(receipt.id);
        const row = (
          await admin.query(
            'SELECT p."priceSnapshot" po,l."acquisitionSnapshot" lot FROM "StockLot" l JOIN "GoodsReceiptLine" r ON r.id=l."originReceiptLineId" JOIN "PurchaseOrderLine" p ON p.id=r."orderLineId" WHERE r."receiptId"=$1',
            [receipt.id],
          )
        ).rows[0];
        assert.equal(row.lot.originalCurrency, "TRY");
        assert.deepEqual(row.lot.fxSnapshot, row.po.fxSnapshot);
        if (row.po.usdPurchaseUnitPrice === null)
          assert.equal(row.lot.lineTotalUsd, null);
        else
          assert(
            new Decimal(row.lot.lineTotalUsd).eq(row.po.usdPurchaseUnitPrice),
          );
      },
    );
    await check("DRAFT and CANCELLED PO cannot create receipt", async () => {
      const order = await ok("purchase-orders", "POST", {
        idempotencyKey: randomUUID(),
        supplierId: supplier.id,
        revisesOrderId: null,
        lines: [
          {
            supplierMaterialId: link.id,
            offerVersionId: null,
            orderedQty: "2",
            purchaseUnit: "linear_meter",
            expectedDate: null,
            manualCurrency: "USD",
            manualUnitPrice: "15.2",
          },
        ],
      });
      const line = (
        await admin.query(
          'SELECT id FROM "PurchaseOrderLine" WHERE "orderId"=$1',
          [order.id],
        )
      ).rows[0].id;
      assert.equal(
        (
          await request(
            "goods-receipts",
            "POST",
            body({ id: order.id, line }, "1"),
          )
        ).status,
        409,
      );
      await ok("purchase-orders/" + order.id + "/cancel", "POST", {
        version: 1,
      });
      assert.equal(
        (
          await request(
            "goods-receipts",
            "POST",
            body({ id: order.id, line }, "1"),
          )
        ).status,
        409,
      );
    });

    await check(
      "cumulative cost rounding reconciles independent tiny partials and preserves editable decimal strings",
      async () => {
        const order = await po();
        for (let i = 0; i < 4; i++) {
          const receipt = await draft(order, "0.000000001");
          const detail = await ok("goods-receipts/" + receipt.id);
          assert.equal(detail.lines[0].receivedQty, "0.000000001");
          await post(receipt.id);
        }
        const row = (
          await admin.query(
            'SELECT sum((l."acquisitionSnapshot"->>\'lineTotalUsd\')::numeric)::text total,sum(l."initialBaseQty")::text qty FROM "StockLot" l JOIN "GoodsReceiptLine" rl ON rl.id=l."originReceiptLineId" WHERE rl."orderLineId"=$1',
            [order.line],
          )
        ).rows[0];
        assert(new Decimal(row.qty).eq("0.000000004"));
        assert(
          new Decimal(row.total).eq(
            new Decimal("0.000000004")
              .mul("15.2")
              .toDecimalPlaces(9, Decimal.ROUND_HALF_UP),
          ),
        );
      },
    );

    await check(
      "approved receipt-order picker includes authorized source and current accepted quantities",
      async () => {
        const rows = await ok("receipt-orders");
        assert(rows.some((x: { id: string }) => x.id === o.id));
        const source = rows.find((x: { id: string }) => x.id === o.id);
        assert(new Decimal(source.lines[0].acceptedQty).eq(2));
      },
    );
    await check(
      "raw command rejects missing version reason and missing line array",
      async () => {
        const source = await po(),
          x = await draft(source, "1");
        const createBody = { ...scope, ...body(source, "1") } as Record<
          string,
          unknown
        >;
        delete createBody.lines;
        for (const [op, payload] of [
          ["create", createBody],
          ["post", { ...scope, id: x.id }],
          ["cancel", { ...scope, id: x.id, version: 1 }],
        ]) {
          const client = await runtime();
          try {
            await assert.rejects(() =>
              client.query("SELECT v43b_command($1,$2::jsonb)", [
                op,
                JSON.stringify(payload),
              ]),
            );
          } finally {
            await client.query("ROLLBACK");
            await client.end();
          }
        }
      },
    );
    await check(
      "variant stock profile cannot switch physical authority after first lot",
      async () => {
        await admin.query('UPDATE "Material" SET roll=false WHERE id=$1', [
          mat.id,
        ]);
        await admin.query(
          'UPDATE "SupplierMaterial" SET "purchaseUnit"=$2,version=version+1 WHERE id=$1',
          [link.id, "square_meter"],
        );
        try {
          const x = await draft(
            await po("2", "USD", link.id, "square_meter"),
            "1",
          );
          const before = await counts();
          assert.equal(
            (
              await request("goods-receipts/" + x.id + "/post", "POST", {
                version: 1,
              })
            ).status,
            409,
          );
          assert.deepEqual(await counts(), before);
        } finally {
          await admin.query('UPDATE "Material" SET roll=true WHERE id=$1', [
            mat.id,
          ]);
          await admin.query(
            'UPDATE "SupplierMaterial" SET "purchaseUnit"=$2,version=version+1 WHERE id=$1',
            [link.id, "linear_meter"],
          );
        }
      },
    );

    const outcome = (id: string, action: string) =>
      ok("goods-receipts/" + id + "/outcome", "GET", undefined, action);
    await check(
      "F2 full reversal releases quantity; new receipt has new lot; replay cannot duplicate",
      async () => {
        const order = await po();
        const first = await draft(order, "2");
        await post(first.id);
        assert.equal((await outcome(first.id, "post")).state, "SUCCEEDED");
        await ok("goods-receipts/" + first.id + "/reverse", "POST", {
          version: 2,
          reason: "Correction",
        });
        assert.equal((await outcome(first.id, "reverse")).state, "SUCCEEDED");
        const picker = await ok("receipt-orders");
        assert(
          new Decimal(
            picker.find((x: { id: string }) => x.id === order.id).lines[0]
              .acceptedQty,
          ).eq(0),
        );
        const second = await draft(order, "2");
        await post(second.id);
        await post(second.id);
        assert.equal(
          (
            await request("goods-receipts/" + first.id + "/reverse", "POST", {
              version: 2,
              reason: "Again",
            })
          ).status,
          409,
        );
        const over = await draft(order, "0.1");
        assert.equal(
          (
            await request("goods-receipts/" + over.id + "/post", "POST", {
              version: 1,
            })
          ).body.error,
          "OVER_RECEIPT",
        );
        const rows = (
          await admin.query(
            'SELECT count(DISTINCT l.id)::int lots,sum(m."quantityDeltaBase")::text qty FROM "StockMovement" m JOIN "StockLot" l ON l.id=m."lotId" JOIN "GoodsReceiptLine" rl ON rl.id=m."receiptLineId" WHERE rl."orderLineId"=$1',
            [order.line],
          )
        ).rows[0];
        assert.equal(rows.lots, 2);
        assert(new Decimal(rows.qty).eq(2));
        assert.equal((await ok("goods-receipts/" + first.id)).status, "POSTED");
      },
    );
    await check(
      "F2 partial reversal and reaccept leaves other order quantities unchanged",
      async () => {
        const a = await po(),
          b = await po();
        const ra = await draft(a, "0.75"),
          rb = await draft(b, "1");
        await post(ra.id);
        await post(rb.id);
        await ok("goods-receipts/" + ra.id + "/reverse", "POST", {
          version: 2,
          reason: "Partial correction",
        });
        const next = await draft(a, "2");
        await post(next.id);
        const picker = await ok("receipt-orders");
        assert(
          new Decimal(
            picker.find((x: { id: string }) => x.id === a.id).lines[0]
              .acceptedQty,
          ).eq(2),
        );
        assert(
          new Decimal(
            picker.find((x: { id: string }) => x.id === b.id).lines[0]
              .acceptedQty,
          ).eq(1),
        );
      },
    );

    await check(
      "F2 different lines on one PO retain independent net quantities",
      async () => {
        const line = {
          supplierMaterialId: link.id,
          offerVersionId: null,
          orderedQty: "2",
          purchaseUnit: "linear_meter",
          expectedDate: null,
          manualCurrency: "USD",
          manualUnitPrice: "15.20",
        };
        const order = await ok("purchase-orders", "POST", {
          idempotencyKey: randomUUID(),
          supplierId: supplier.id,
          revisesOrderId: null,
          lines: [line, line],
        });
        await ok("purchase-orders/" + order.id + "/approve", "POST", {
          version: 1,
        });
        const lines = (
          await admin.query(
            'SELECT id FROM "PurchaseOrderLine" WHERE "orderId"=$1 ORDER BY "lineNo"',
            [order.id],
          )
        ).rows;
        const a = await draft({ id: order.id, line: lines[0].id }, "1");
        const b = await draft({ id: order.id, line: lines[1].id }, "2");
        await post(a.id);
        await post(b.id);
        await ok("goods-receipts/" + a.id + "/reverse", "POST", {
          version: 2,
          reason: "Line correction",
        });
        const picker = await ok("receipt-orders");
        const found = picker.find((x: { id: string }) => x.id === order.id);
        assert(
          new Decimal(
            found.lines.find((x: { id: string }) => x.id === lines[0].id)
              .acceptedQty,
          ).eq(0),
        );
        assert(
          new Decimal(
            found.lines.find((x: { id: string }) => x.id === lines[1].id)
              .acceptedQty,
          ).eq(2),
        );
        const again = await draft({ id: order.id, line: lines[0].id }, "2");
        await post(again.id);
      },
    );
    await check(
      "F6 real statement timeout rolls back all stock and audit; SQLSTATE deadlock classification",
      async () => {
        const receipt = await draft(await po(), "2");
        const before = await counts();
        const audits = (
          await admin.query('SELECT count(*)::int n FROM "AuditEvent"')
        ).rows[0].n;
        await admin.query(
          `CREATE FUNCTION fixture_slow_stock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(11); RETURN NEW; END $$;CREATE TRIGGER fixture_slow_stock BEFORE INSERT ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION fixture_slow_stock()`,
        );
        try {
          const result = await request(
            "goods-receipts/" + receipt.id + "/post",
            "POST",
            { version: 1 },
          );
          assert.equal(result.status, 503);
          assert.equal(result.body.error, "STOCK_OUTCOME_UNKNOWN");
        } finally {
          await admin.query(
            'DROP TRIGGER fixture_slow_stock ON "StockMovement";DROP FUNCTION fixture_slow_stock()',
          );
        }
        assert.deepEqual(await counts(), before);
        assert.equal(
          (await outcome(receipt.id, "post")).state,
          "NOT_COMMITTED",
        );
        assert.equal(
          (await admin.query('SELECT count(*)::int n FROM "AuditEvent"'))
            .rows[0].n,
          audits,
        );
        // Synthetic SQLSTATE tests the API mapping, not proof of a naturally occurring deadlock.
        await admin.query(
          `CREATE FUNCTION fixture_deadlock_stock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture deadlock' USING ERRCODE='40P01'; END $$;CREATE TRIGGER fixture_deadlock_stock BEFORE INSERT ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION fixture_deadlock_stock()`,
        );
        try {
          const result = await request(
            "goods-receipts/" + receipt.id + "/post",
            "POST",
            { version: 1 },
          );
          assert.equal(result.status, 409);
          assert.equal(result.body.error, "STOCK_DEADLOCK");
        } finally {
          await admin.query(
            'DROP TRIGGER fixture_deadlock_stock ON "StockMovement";DROP FUNCTION fixture_deadlock_stock()',
          );
        }
        assert.deepEqual(await counts(), before);
      },
    );

    await check(
      "F2 insufficient stock rejects reversal atomically; original trace preserved",
      async () => {
        const order = await po(),
          receipt = await draft(order, "2");
        await post(receipt.id);
        const before = await counts();
        // Only this synthetic failure injection uses the isolated fixture administrator.
        const client = new Client({
          connectionString: process.env.TEST_DIRECT_DATABASE_URL,
        });
        await client.connect();
        await client.query("BEGIN");
        await client.query(
          "SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true),set_config('app.legal_entity_id',$3,true)",
          [ctx.userId, ctx.tenantId, scope.legalEntityId],
        );
        try {
          await client.query("SET LOCAL ROLE pusula_stock_executor");
          await client.query(
            'UPDATE "StockBalance" SET "quantityBase"=0 WHERE "lotId" IN(SELECT l.id FROM "StockLot" l JOIN "GoodsReceiptLine" rl ON rl.id=l."originReceiptLineId" WHERE rl."receiptId"=$1)',
            [receipt.id],
          );
          await assert.rejects(
            () =>
              client.query("SELECT v43b_command($1,$2::jsonb)", [
                "reverse",
                JSON.stringify({
                  ...scope,
                  id: receipt.id,
                  version: 2,
                  reason: "Insufficient test",
                }),
              ]),
            (e: unknown) =>
              (e as { message: string }).message.includes("INSUFFICIENT_STOCK"),
          );
        } finally {
          await client.query("ROLLBACK");
          await client.end();
        }
        assert.deepEqual(await counts(), before);
        assert.equal(
          (await outcome(receipt.id, "reverse")).state,
          "NOT_COMMITTED",
        );
      },
    );
    const waitLock = async (pid: number) => {
      for (let i = 0; i < 100; i++) {
        if (
          (
            await admin.query(
              "SELECT wait_event_type='Lock' yes FROM pg_stat_activity WHERE pid=$1",
              [pid],
            )
          ).rows[0]?.yes
        )
          return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.fail("Expected real PostgreSQL lock wait");
    };
    for (const action of ["post", "reverse"])
      await check(
        "F1 deterministic create + " + action + " with two runtime backends",
        async () => {
          const order = await po();
          const receipt = await draft(order, "1");
          if (action === "reverse") await post(receipt.id);
          const c1 = await runtime(),
            c2 = await runtime();
          try {
            await c1.query(
              "SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='8s'",
            );
            await c2.query(
              "SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='8s'",
            );
            const pid1 = (await c1.query("SELECT pg_backend_pid() pid")).rows[0]
              .pid;
            const pid2 = (await c2.query("SELECT pg_backend_pid() pid")).rows[0]
              .pid;
            assert.notEqual(pid1, pid2);
            await admin.query("BEGIN");
            await admin.query(
              'SELECT id FROM "StockLocation" WHERE id=$1 FOR UPDATE',
              [location.id],
            );
            const creating = c1
              .query("SELECT v43b_command($1,$2::jsonb)", [
                "create",
                JSON.stringify({ ...scope, ...body(order, "1") }),
              ])
              .then(
                () => null,
                (e: unknown) => e,
              );
            await waitLock(pid1);
            const posting = c2
              .query("SELECT v43b_command($1,$2::jsonb)", [
                action,
                JSON.stringify({
                  ...scope,
                  id: receipt.id,
                  version: 1,
                  reason: "Race correction",
                }),
              ])
              .then(
                () => null,
                (e: unknown) => e,
              );
            await waitLock(pid2);
            const blockers = (
              await admin.query("SELECT pg_blocking_pids($1) p", [pid2])
            ).rows[0].p;
            assert(
              blockers.includes(pid1),
              "Command must wait on PO held by create, not location",
            );
            await admin.query("COMMIT");
            assert.equal(await creating, null);
            await c1.query("COMMIT");
            assert.equal(await posting, null);
            await c2.query("COMMIT");
            const count = (
              await admin.query(
                'SELECT count(*)::int n FROM "StockPostingBatch" WHERE "receiptId"=$1 AND kind=$2',
                [receipt.id, action === "post" ? "RECEIPT" : "REVERSAL"],
              )
            ).rows[0].n;
            assert.equal(count, 1);
          } finally {
            await admin.query("ROLLBACK");
            await c1.query("ROLLBACK");
            await c2.query("ROLLBACK");
            await c1.end();
            await c2.end();
          }
        },
      );
    await check(
      "F6 precommit rollback, lost response reconciliation and same post concurrency",
      async () => {
        const order = await po(),
          receipt = await draft(order, "2");
        const before = await counts();
        const c = await runtime();
        try {
          await c.query("SELECT v43b_command($1,$2::jsonb)", [
            "post",
            JSON.stringify({ ...scope, id: receipt.id, version: 1 }),
          ]);
          await c.query("ROLLBACK");
        } finally {
          await c.end();
        }
        assert.deepEqual(await counts(), before);
        assert.equal(
          (await outcome(receipt.id, "post")).state,
          "NOT_COMMITTED",
        );
        const a = await runtime(),
          b = await runtime();
        try {
          await a.query("SELECT v43b_command($1,$2::jsonb)", [
            "post",
            JSON.stringify({ ...scope, id: receipt.id, version: 1 }),
          ]);
          const pid = (await b.query("SELECT pg_backend_pid() pid")).rows[0]
            .pid;
          const pending = b.query("SELECT v43b_command($1,$2::jsonb)", [
            "post",
            JSON.stringify({ ...scope, id: receipt.id, version: 1 }),
          ]);
          await waitLock(pid);
          await a.query("COMMIT");
          await pending;
          await b.query("COMMIT");
        } finally {
          await a.query("ROLLBACK");
          await b.query("ROLLBACK");
          await a.end();
          await b.end();
        }
        // The caller intentionally discards the successful mutation response and reads status.
        assert.equal((await outcome(receipt.id, "post")).state, "SUCCEEDED");
        assert.equal(
          (
            await admin.query(
              'SELECT count(*)::int n FROM "StockPostingBatch" WHERE "receiptId"=$1',
              [receipt.id],
            )
          ).rows[0].n,
          1,
        );
        const holder = await runtime();
        try {
          await holder.query("SELECT v43b_command($1,$2::jsonb)", [
            "post",
            JSON.stringify({ ...scope, id: receipt.id, version: 1 }),
          ]);
          const waiting = request(
            "goods-receipts/" + receipt.id + "/outcome",
            "GET",
            undefined,
            "post",
          );
          const result = await waiting;
          assert.equal(result.status, 409);
          assert.equal(result.body.error, "STOCK_LOCK_TIMEOUT");
        } finally {
          await holder.query("ROLLBACK");
          await holder.end();
        }
      },
    );

    await check(
      "F6 outcome waits for in-flight post commit or rollback before answering",
      async () => {
        for (const finish of ["COMMIT", "ROLLBACK"]) {
          const receipt = await draft(await po(), "2");
          const a = await runtime(),
            b = await runtime();
          try {
            await a.query("SELECT v43b_command($1,$2::jsonb)", [
              "post",
              JSON.stringify({ ...scope, id: receipt.id, version: 1 }),
            ]);
            const pid = (await b.query("SELECT pg_backend_pid() pid")).rows[0]
              .pid;
            const pending = b.query(
              "SELECT v43b_receipt_outcome($1,$2) state",
              [receipt.id, "post"],
            );
            await waitLock(pid);
            await a.query(finish);
            assert.equal(
              (await pending).rows[0].state,
              finish === "COMMIT" ? "SUCCEEDED" : "NOT_COMMITTED",
            );
            await b.query("COMMIT");
          } finally {
            await a.query("ROLLBACK");
            await b.query("ROLLBACK");
            await a.end();
            await b.end();
          }
        }
      },
    );
    await check(
      "ledger independently recomputed equals balances; no negative stock",
      async () => {
        const bad = (
          await admin.query(
            `SELECT count(*)::int n FROM "StockBalance" b WHERE b."quantityBase"<0 OR b."quantityBase"<>(SELECT coalesce(sum(m."quantityDeltaBase"),0) FROM "StockMovement" m WHERE m."lotId"=b."lotId" AND m."locationId"=b."locationId")`,
          )
        ).rows[0].n;
        assert.equal(bad, 0);
      },
    );

    await check(
      "all pre-existing PO material offer and quote-sale snapshot rows remain unchanged",
      async () => {
        for (const [table, baseline] of Object.entries(legacy)) {
          const result = (
            await admin.query(
              'SELECT count(*)::int n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),chr(0+32) ORDER BY id),chr(0+32))) digest FROM public."' +
                table +
                '" t WHERE id=ANY($1::uuid[])',
              [baseline.ids],
            )
          ).rows[0];
          assert.equal(result.n, baseline.ids.length);
          assert.equal(result.digest, baseline.digest);
        }
      },
    );
    console.log(`Stock real API/SQL acceptance: ${n} checks`);
  } finally {
    await admin.end();
    await f.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
