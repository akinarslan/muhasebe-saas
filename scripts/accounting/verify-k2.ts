import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { masterFixture } from "../auth/master-fixture";
import { cloudRequest } from "../../src/server/cloud/handler";
import { contextFor, scoped } from "../../src/server/authorization/context";
import { requireLocalAccounting } from "../../src/server/cloud/business/accounting/accounts";

async function main() {
  requireLocalAccounting();
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
    const c = await contextFor(f.headers(), f.db, f.source),
      boot = await f.source.db.authBootstrap.findFirstOrThrow();
    const scope = { legalEntityId: boot.legalEntityId, activityId: null };
    const request = async (
      path: string,
      method = "GET",
      body?: object,
      headers = f.headers(),
    ) => {
      const r = await cloudRequest(
        new Request(
          `http://127.0.0.1:3000/api/cloud/${path.startsWith("exchange") ? "" : "workspace/"}${path}?company=${scope.legalEntityId}&through=2026-10-29`,
          {
            method,
            headers,
            ...(body ? { body: JSON.stringify({ ...scope, ...body }) } : {}),
          },
        ),
        f.db,
        f.source,
      );
      return { status: r.status, body: await r.json() };
    };
    const ok = async (path: string, method = "GET", body?: object) => {
      const r = await request(path, method, body);
      assert.equal(r.status, 200, JSON.stringify(r));
      return r.body;
    };
    const customer = await ok("customers", "POST", {
      idempotencyKey: randomUUID(),
      name: "K2 vinyl customer",
    });
    const mat = await ok("materials", "POST", {
      idempotencyKey: randomUUID(),
      name: "K2 synthetic vinyl",
      unit: "square_meter",
      roll: true,
      margins: { left: 2, right: 2, top: 2, bottom: 2 },
      variants: [{ name: "152", widthCm: 152, inStock: true, usdCost: "2" }],
    });
    const material = (await ok("catalog")).find(
      (m: { id: string }) => m.id === mat.id,
    );
    const product = await ok("products", "POST", {
      idempotencyKey: randomUUID(),
      name: "K2 vinyl printing",
      kind: "manufacture",
      unit: "m²",
    });
    const rr = await cloudRequest(
      new Request("http://127.0.0.1:3000/api/cloud/exchange-rate", {
        method: "POST",
        headers: f.headers(),
        body: JSON.stringify({
          usdTry: "40",
          reason: "K2 synthetic fixed exchange",
        }),
      }),
      f.db,
      f.source,
    );
    assert.equal(rr.status, 201);
    const rate = await rr.json();
    const sale = {
      ...scope,
      customerId: customer.id,
      idempotencyKey: randomUUID(),
      date: "2026-10-22",
      dueDate: "2026-10-29",
      currency: "TRY",
      notes: "K2 synthetic 10 square metres",
      rate: { kind: "manual", id: rate.id },
      plans: [],
      lines: [
        {
          productId: product.id,
          description: "100x200cm x5 vinyl = 10m²",
          quantity: 5,
          widthCm: 100,
          heightCm: 200,
          discount: 0,
          vat: 20,
          costing: {
            materials: [
              {
                id: "vinyl",
                materialId: mat.id,
                variantId: material.variants[0].id,
                widthCm: 100,
                heightCm: 200,
                quantity: 5,
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
            manualNetUsd: 100,
            vat: 20,
          },
        },
      ],
    };
    const counts = async () =>
      (
        await admin.query(
          `SELECT (SELECT count(*)::int FROM "CloudSale") sales,(SELECT count(*)::int FROM "CloudSaleLine") lines,(SELECT count(*)::int FROM "FinanceJournal") journals,(SELECT count(*)::int FROM "FinancePosting") postings,(SELECT count(*)::int FROM "FinanceAccount") accounts,(SELECT count(*)::int FROM "AuditEvent") audits`,
        )
      ).rows[0];
    let sid = "",
      jid = "",
      snapshot = "";
    await check(
      "10m2 sale and receivable commit together with automatic party account",
      async () => {
        assert.equal(
          (
            await admin.query(
              'SELECT count(*)::int n FROM "FinanceAccount" WHERE "customerId"=$1',
              [customer.id],
            )
          ).rows[0].n,
          0,
        );
        const r = await ok("sales", "POST", sale);
        sid = r.id;
        const s = (
          await admin.query('SELECT * FROM "CloudSale" WHERE id=$1', [sid])
        ).rows[0];
        assert.equal(s.netTry, "4000.00");
        assert.equal(s.vatTry, "800.00");
        assert.equal(s.totalTry, "4800.00");
        assert.equal(s.netUsd, "100.000000");
        assert.equal(s.costUsd, "31.008000");
        assert.equal(s.rateSnapshot.value, 40);
        const j = (
          await admin.query(
            'SELECT * FROM "FinanceJournal" WHERE "saleId"=$1',
            [sid],
          )
        ).rows[0];
        jid = j.id;
        assert.equal(j.netTry, "4000.00");
        assert.equal(j.vatTry, "800.00");
        assert.equal(j.grossTry, "4800.00");
        const p = (
          await admin.query(
            'SELECT a.kind,p.debit::text,p.credit::text FROM "FinancePosting" p JOIN "FinanceAccount" a ON a.id=p."accountId" WHERE p."journalId"=$1 ORDER BY a.kind',
            [jid],
          )
        ).rows;
        assert.deepEqual(p, [
          { kind: "CUSTOMER", debit: "4800.00", credit: "0.00" },
          { kind: "REVENUE", debit: "0.00", credit: "4000.00" },
          { kind: "VAT", debit: "0.00", credit: "800.00" },
        ]);
        snapshot = JSON.stringify(
          (
            await admin.query(
              'SELECT "rateSnapshot","costUsd","netUsd" FROM "CloudSale" WHERE id=$1',
              [sid],
            )
          ).rows[0],
        );
      },
    );
    await check(
      "sale finance API and statement expose gross receivable not cost snapshots",
      async () => {
        const r = await ok(`finance/sales/${sid}`);
        assert.equal(r.status, "POSTED");
        assert.equal(r.journal.id, jid);
        assert.equal(r.statement.balance, "4800.00");
        assert.equal(r.statement.entries[0].dueOn, "2026-10-29");
        assert.ok(!JSON.stringify(r).includes("costUsd"));
      },
    );
    await check(
      "same request concurrent replay and different key duplicate rejection",
      async () => {
        const before = await counts();
        const rows = await Promise.all([
          ok("sales", "POST", sale),
          ok("sales", "POST", sale),
        ]);
        assert.equal(rows[0].id, sid);
        assert.equal(rows[1].id, sid);
        assert.equal(
          (
            await request("sales", "POST", {
              ...sale,
              idempotencyKey: randomUUID(),
            })
          ).status,
          409,
        );
        assert.deepEqual(await counts(), before);
      },
    );
    await check(
      "business source reference independent of request key",
      async () => {
        const r = await ok("sales", "POST", {
          ...sale,
          idempotencyKey: randomUUID(),
          sourceRef: "K2-SOURCE-2",
        });
        assert.notEqual(r.id, sid);
        const before = await counts();
        assert.equal(
          (
            await request("sales", "POST", {
              ...sale,
              idempotencyKey: randomUUID(),
              sourceRef: "K2-SOURCE-2",
              notes: "changed attempt",
            })
          ).status,
          409,
        );
        assert.deepEqual(await counts(), before);
      },
    );
    await check(
      "late finance insertion failure rolls back sale lines journal postings and audit",
      async () => {
        const before = await counts();
        await admin.query(
          'REVOKE INSERT ON "FinancePosting" FROM pusula_finance_executor',
        );
        try {
          assert.equal(
            (
              await request("sales", "POST", {
                ...sale,
                idempotencyKey: randomUUID(),
                sourceRef: "K2-ROLLBACK",
              })
            ).status,
            409,
          );
        } finally {
          await admin.query(
            'GRANT INSERT ON "FinancePosting" TO pusula_finance_executor',
          );
        }
        assert.deepEqual(await counts(), before);
      },
    );
    await check(
      "deferred constraint rejects bare sale commit without journal",
      async () => {
        const id = randomUUID();
        await admin.query("BEGIN");
        try {
          await admin.query(
            `INSERT INTO "CloudSale" SELECT (jsonb_populate_record(NULL::"CloudSale",to_jsonb(s)||jsonb_build_object('id',$1::text,'idempotencyKey',$2::text))).* FROM "CloudSale" s WHERE id=$3`,
            [id, randomUUID(), sid],
          );
          await assert.rejects(
            admin.query("COMMIT"),
            /FINANCE_SALE_JOURNAL_REQUIRED/,
          );
        } finally {
          await admin.query("ROLLBACK");
        }
        assert.equal(
          (
            await admin.query(
              'SELECT count(*)::int n FROM "CloudSale" WHERE id=$1',
              [id],
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await check(
      "reviewed historical import stays unposted and direct backfill is rejected",
      async () => {
        const legacy = (
          await admin.query(
            `SELECT id FROM "CloudSale" WHERE "rateSnapshot"->>'historical'='true' LIMIT 1`,
          )
        ).rows[0].id;
        assert.equal(
          (await ok(`finance/sales/${legacy}`)).status,
          "LEGACY_UNPOSTED",
        );
        await assert.rejects(
          scoped(
            c,
            async (tx) => {
              await tx.$queryRaw`SELECT set_config('app.activity_id','',true)`;
              return tx.$queryRaw`SELECT k2_post_sale(${legacy}::uuid,'legacy-test')`;
            },
            f.db,
            scope.legalEntityId,
          ),
        );
        assert.equal(
          (
            await admin.query(
              'SELECT count(*)::int n FROM "FinanceJournal" WHERE "saleId"=$1',
              [legacy],
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await check(
      "wrong tenant and identity cannot read sale finance or invoke posting",
      async () => {
        for (const changed of [
          { tenantId: randomUUID() },
          { userId: randomUUID() },
        ]) {
          const rows = await scoped(
            { ...c, ...changed },
            (tx) =>
              tx.$queryRaw<
                unknown[]
              >`SELECT * FROM "FinanceJournal" WHERE "saleId"=${sid}::uuid`,
            f.db,
            scope.legalEntityId,
          );
          assert.equal(rows.length, 0);
          await assert.rejects(
            scoped(
              { ...c, ...changed },
              (tx) =>
                tx.$queryRaw`SELECT k2_post_sale(${sid}::uuid,'wrong-scope')`,
              f.db,
              scope.legalEntityId,
            ),
          );
        }
        assert.equal(
          (
            await request(
              `finance/sales/${sid}`,
              "GET",
              undefined,
              new Headers(),
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await request("sales", "POST", {
              ...sale,
              idempotencyKey: randomUUID(),
              legalEntityId: randomUUID(),
            })
          ).status,
          404,
        );
      },
    );
    await check(
      "explicit DENY finance and sales permissions prevents partial sale",
      async () => {
        for (const permission of [
          "finance.accounts",
          "finance.approve",
          "sales.create",
        ]) {
          const scopeId = randomUUID(),
            override = randomUUID();
          await admin.query(
            'INSERT INTO "PermissionScope"(id,"tenantId",kind) VALUES($1,$2,\'TENANT\')',
            [scopeId, c.tenantId],
          );
          await admin.query(
            'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,$4,\'DENY\',$5)',
            [override, c.tenantId, c.membershipId, permission, scopeId],
          );
          const before = await counts();
          try {
            assert.equal(
              (
                await request("sales", "POST", {
                  ...sale,
                  idempotencyKey: randomUUID(),
                  sourceRef: randomUUID(),
                })
              ).status,
              403,
            );
            if (permission === "finance.accounts")
              assert.equal((await request(`finance/sales/${sid}`)).status, 403);
          } finally {
            await admin.query(
              'DELETE FROM "UserPermissionOverride" WHERE id=$1',
              [override],
            );
          }
          assert.deepEqual(await counts(), before);
        }
      },
    );
    await check(
      "sale cancellation DENY also blocks financial reversal",
      async () => {
        const scopeId = randomUUID(),
          override = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind) VALUES($1,$2,\'TENANT\')',
          [scopeId, c.tenantId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,\'sales.cancel\',\'DENY\',$4)',
          [override, c.tenantId, c.membershipId, scopeId],
        );
        try {
          assert.equal(
            (
              await request("finance/reversals", "POST", {
                journalId: jid,
                idempotencyKey: randomUUID(),
                bookedOn: "2026-10-23",
                reason: "Denied cancellation",
              })
            ).status,
            409,
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
      "three-leg sale reversal preserves source and snapshots",
      async () => {
        const r = await ok("finance/reversals", "POST", {
          journalId: jid,
          idempotencyKey: randomUUID(),
          bookedOn: "2026-10-23",
          reason: "K2 synthetic cancellation basis",
        });
        assert.equal(
          (
            await admin.query(
              'SELECT count(*)::int n,sum(debit-credit)::text delta FROM "FinancePosting" WHERE "journalId"=$1',
              [r.id],
            )
          ).rows[0].n,
          3,
        );
        assert.equal((await ok(`finance/sales/${sid}`)).status, "REVERSED");
        assert.equal(
          (await ok(`finance/sales/${sid}`)).statement.balance,
          "4800.00",
        ); // second distinct sale remains open
        assert.equal(
          JSON.stringify(
            (
              await admin.query(
                'SELECT "rateSnapshot","costUsd","netUsd" FROM "CloudSale" WHERE id=$1',
                [sid],
              )
            ).rows[0],
          ),
          snapshot,
        );
        assert.equal(
          (await request(`sales/${sid}/cancel`, "POST", {})).status,
          404,
        );
        await assert.rejects(
          admin.query('DELETE FROM "FinanceJournal" WHERE id=$1', [jid]),
          /FINANCE_IMMUTABLE/,
        );
      },
    );
    await check(
      "runtime finance DML and public function execute remain denied",
      async () => {
        await assert.rejects(
          scoped(
            c,
            (tx) => tx.$executeRaw`DELETE FROM "FinancePosting"`,
            f.db,
            scope.legalEntityId,
          ),
        );
        assert.equal(
          (
            await admin.query(
              "SELECT has_function_privilege('public','k2_post_sale(uuid,text)','EXECUTE') allowed",
            )
          ).rows[0].allowed,
          false,
        );
        assert.equal(
          (
            await admin.query(
              "SELECT pg_has_role('pusula_test_runtime','pusula_finance_executor','SET') allowed",
            )
          ).rows[0].allowed,
          false,
        );
      },
    );
    await check(
      "USD finance requires explicit future FX acceptance and remains rejected",
      async () => {
        const before = await counts();
        assert.equal(
          (
            await request("sales", "POST", {
              ...sale,
              idempotencyKey: randomUUID(),
              sourceRef: randomUUID(),
              currency: "USD",
            })
          ).status,
          409,
        );
        assert.deepEqual(await counts(), before);
      },
    );
    await check("fixture-only gate blocks cloud sale path", async () => {
      const old = process.env.PUSULA_LOCAL_FIXTURE;
      try {
        delete process.env.PUSULA_LOCAL_FIXTURE;
        assert.equal((await request("sales", "POST", sale)).status, 503);
      } finally {
        process.env.PUSULA_LOCAL_FIXTURE = old;
      }
    });
    await check(
      "MFA step-up needed for sale and history stays sixteen",
      async () => {
        await f.source.db.authSession.updateMany({ data: { stepUpAt: null } });
        assert.equal(
          (
            await request("sales", "POST", {
              ...sale,
              idempotencyKey: randomUUID(),
              sourceRef: randomUUID(),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await admin.query(
              "SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
            )
          ).rows[0].n,
          16,
        );
      },
    );
  } finally {
    await admin.end();
    await f.close();
  }
}
main().catch(() => {
  console.error(
    "ACCOUNTING_K2_FIXTURE_FAILED (payloads suppressed; inspect last completed named check)",
  );
  process.exitCode = 1;
});
