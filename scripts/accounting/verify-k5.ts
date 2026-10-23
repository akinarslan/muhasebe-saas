import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import Decimal from "decimal.js";
import { masterFixture } from "../auth/master-fixture";
import { contextFor } from "../../src/server/authorization/context";
import { cloudRequest } from "../../src/server/cloud/handler";
import { requireLocalAccounting } from "../../src/server/cloud/business/accounting/accounts";
import { k5Staff } from "./k5-staff";

async function main() {
  requireLocalAccounting();
  const f = await masterFixture(),
    admin = new Client({
      connectionString: process.env.TEST_DIRECT_DATABASE_URL,
    });
  await admin.connect();
  let checks = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    await fn();
    console.log(`PASS K5 ${++checks}: ${name}`);
  };
  try {
    const c = await contextFor(f.headers(), f.db, f.source),
      boot = await f.source.db.authBootstrap.findFirstOrThrow(),
      scope = { legalEntityId: boot.legalEntityId, activityId: null };
    const request = async (
      path: string,
      method = "GET",
      body?: object,
      headers = f.headers(),
    ) => {
      const r = await cloudRequest(
        new Request(
          `http://127.0.0.1:3000/api/cloud/workspace/${path}${path.includes("?") ? "&" : "?"}company=${scope.legalEntityId}&through=2026-10-26`,
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
    const ok = async (
      path: string,
      method = "GET",
      body?: object,
      h = f.headers(),
    ) => {
      const r = await request(path, method, body, h);
      assert.equal(r.status, 200, JSON.stringify(r));
      return r.body;
    };
    const intent = async (kind: string, h = f.headers()) =>
      (
        await ok(
          "finance/intents",
          "POST",
          { kind, clientKey: randomUUID() },
          h,
        )
      ).id;
    const op = async (kind: string, extra: object, h = f.headers()) => ({
      intentId: await intent(kind, h),
      idempotencyKey: randomUUID(),
      currency: "TRY",
      amount: "0",
      fee: "0",
      bookedOn: "2026-10-26",
      reason: "K5 integrated business acceptance",
      ...extra,
    });
    const summary = () => ok("finance/summary?from=2026-10-26");
    const journal = async (id: string) =>
      (
        await admin.query(
          'SELECT "journalId" FROM "FinanceOperation" WHERE id=$1',
          [id],
        )
      ).rows[0].journalId;
    const financialCounts = async () =>
      (
        await admin.query(
          `SELECT (SELECT count(*)::int FROM "FinanceJournal") journals,(SELECT count(*)::int FROM "FinancePosting") postings,(SELECT count(*)::int FROM "FinanceOperation") operations,(SELECT count(*)::int FROM "FinanceAllocation") allocations,(SELECT count(*)::int FROM "FinanceFundMovement") movements,(SELECT count(*)::int FROM "FinanceExpense") expenses`,
        )
      ).rows[0];
    const customer = await ok("customers", "POST", {
      idempotencyKey: randomUUID(),
      name: "K5 ZY synthetic customer",
    });
    const material = await ok("materials", "POST", {
      idempotencyKey: randomUUID(),
      name: "K5 vinyl",
      unit: "square_meter",
      roll: true,
      margins: { left: 2, right: 2, top: 2, bottom: 2 },
      variants: [{ name: "152", widthCm: 152, inStock: true, usdCost: "2" }],
    });
    const catalog = (await ok("catalog")).find(
      (m: { id: string }) => m.id === material.id,
    );
    const product = await ok("products", "POST", {
      idempotencyKey: randomUUID(),
      name: "K5 vinyl printing",
      kind: "manufacture",
      unit: "m²",
    });
    const rr = await cloudRequest(
      new Request("http://127.0.0.1:3000/api/cloud/exchange-rate", {
        method: "POST",
        headers: f.headers(),
        body: JSON.stringify({
          usdTry: "40",
          reason: "K5 fixed synthetic rate",
        }),
      }),
      f.db,
      f.source,
    );
    assert.equal(rr.status, 201);
    const rate = await rr.json();
    const cash = (
      await ok("finance/funds", "POST", { kind: "CASH", label: "K5 cash" })
    ).id;
    const initial = await summary(),
      stockBefore = (
        await admin.query('SELECT count(*)::int n FROM "StockMovement"')
      ).rows[0].n;
    const saleBody = {
      customerId: customer.id,
      date: "2026-10-26",
      dueDate: "2026-10-29",
      currency: "TRY",
      notes: "10m2 vinyl synthetic acceptance",
      rate: { kind: "manual", id: rate.id },
      plans: [],
      lines: [
        {
          productId: product.id,
          description: "100x200cm x5 = 10m2",
          quantity: 5,
          widthCm: 100,
          heightCm: 200,
          discount: 0,
          vat: 20,
          costing: {
            materials: [
              {
                id: "vinyl",
                materialId: material.id,
                variantId: catalog.variants[0].id,
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
    let saleId = "",
      saleJ = "",
      accountId = "";
    await check(
      "10m2 real sale net4000 VAT800 gross4800 and receivable without physical stock consumption",
      async () => {
        saleId = (
          await ok("sales", "POST", {
            ...saleBody,
            idempotencyKey: randomUUID(),
            sourceRef: `intent:${await intent("SALE")}`,
          })
        ).id;
        const fin = await ok(`finance/sales/${saleId}`);
        saleJ = fin.journal.id;
        accountId = fin.journal.accountId;
        assert.deepEqual(
          [fin.journal.netTry, fin.journal.vatTry, fin.journal.grossTry],
          ["4000.00", "800.00", "4800.00"],
        );
        assert.equal(new Decimal(fin.outstanding).toFixed(2), "4800.00");
        assert.equal(
          (await admin.query('SELECT count(*)::int n FROM "StockMovement"'))
            .rows[0].n,
          stockBefore,
        );
      },
    );
    const permissions = [
      "finance.accounts",
      "finance.collect",
      "finance.cash",
      "sales.view",
    ];
    const a = await k5Staff(
        f,
        admin,
        c.tenantId,
        scope.legalEntityId,
        permissions,
      ),
      b = await k5Staff(f, admin, c.tenantId, scope.legalEntityId, permissions);
    for (const user of [a, b])
      await ok("finance/access", "POST", {
        fundAccountId: cash,
        userId: user.userId,
        grant: true,
      });
    const collection = await op(
      "COLLECT",
      {
        sourceJournalId: saleJ,
        accountId,
        fundAccountId: cash,
        method: "CASH",
        amount: "2000",
      },
      a.headers,
    );
    await check(
      "staff A partial2000 cash receipt leaves2800; duplicate request returns same economic event",
      async () => {
        const one = await ok("finance/collect", "POST", collection, a.headers),
          count = await financialCounts();
        const two = await ok(
          "finance/collect",
          "POST",
          { ...collection, idempotencyKey: randomUUID() },
          a.headers,
        );
        assert.equal(one.id, two.id);
        assert.deepEqual(await financialCounts(), count);
        assert.equal(
          new Decimal(
            (await ok(`finance/sales/${saleId}`)).outstanding,
          ).toFixed(2),
          "2800.00",
        );
      },
    );
    await check(
      "500 cash operating expense and daily balance net1500",
      async () => {
        await ok("finance/expenses", "POST", {
          intentId: await intent("EXPENSE"),
          idempotencyKey: randomUUID(),
          currency: "TRY",
          category: "TRANSPORT",
          description: "K5 delivery consumed service",
          documentRef: `K5-EXP-${randomUUID()}`,
          bookedOn: "2026-10-26",
          dueOn: null,
          net: "500",
          vat: "0",
          supplierId: null,
          payment: "CASH",
          fundAccountId: cash,
        });
        const s = await summary();
        for (const [key, delta] of Object.entries({
          netSales: 4000,
          salesVat: 800,
          grossSales: 4800,
          collections: 2000,
          payments: 500,
          expensesNet: 500,
          cashMovement: 1500,
          cash: 1500,
        }))
          assert.equal(
            new Decimal(s[key]).minus(initial[key]).toFixed(2),
            new Decimal(delta).toFixed(2),
            key,
          );
      },
    );
    await check(
      "staff B final2800 receipt closes original customer liability",
      async () => {
        await ok(
          "finance/collect",
          "POST",
          await op(
            "COLLECT",
            {
              sourceJournalId: saleJ,
              accountId,
              fundAccountId: cash,
              method: "CASH",
              amount: "2800",
            },
            b.headers,
          ),
          b.headers,
        );
        assert.equal(
          new Decimal(
            (await ok(`finance/sales/${saleId}`)).outstanding,
          ).toFixed(2),
          "0.00",
        );
        assert.equal(
          new Decimal(
            (await ok(`finance/${accountId}/statement`)).balance,
          ).toFixed(2),
          "0.00",
        );
      },
    );
    const supplier = await ok("suppliers", "POST", {
      idempotencyKey: randomUUID(),
      name: "K5 maintenance supplier",
    });
    let expenseJ = "",
      paymentId = "";
    await check(
      "supplier credit expense1200 partial300 leaves900 and payment reversal restores1200",
      async () => {
        const expense = await ok("finance/expenses", "POST", {
          intentId: await intent("EXPENSE"),
          idempotencyKey: randomUUID(),
          currency: "TRY",
          category: "MAINTENANCE",
          description: "K5 consumed maintenance",
          documentRef: `K5-MAINT-${randomUUID()}`,
          bookedOn: "2026-10-26",
          dueOn: "2026-10-29",
          net: "1000",
          vat: "200",
          supplierId: supplier.id,
          payment: "CREDIT",
          fundAccountId: null,
        });
        expenseJ = await journal(expense.id);
        paymentId = (
          await ok(
            "finance/pay",
            "POST",
            await op("PAY", {
              sourceJournalId: expenseJ,
              fundAccountId: cash,
              method: "CASH",
              amount: "300",
            }),
          )
        ).id;
        const outstanding = async () =>
          new Decimal(
            (await ok("finance/documents?party=SUPPLIER")).find(
              (x: { journalId: string }) => x.journalId === expenseJ,
            ).outstanding,
          ).toFixed(2);
        assert.equal(await outstanding(), "900.00");
        await ok("finance/reversals", "POST", {
          journalId: await journal(paymentId),
          idempotencyKey: randomUUID(),
          bookedOn: "2026-10-26",
          reason: "K5 wrong payment correction",
        });
        assert.equal(await outstanding(), "1200.00");
        await ok(
          "finance/pay",
          "POST",
          await op("PAY", {
            sourceJournalId: expenseJ,
            fundAccountId: cash,
            method: "CASH",
            amount: "300",
          }),
        );
        assert.equal(await outstanding(), "900.00");
      },
    );
    await check(
      "two different authenticated staff concurrently collect same remaining source without over-allocation",
      async () => {
        const sale = (
          await ok("sales", "POST", {
            ...saleBody,
            idempotencyKey: randomUUID(),
            sourceRef: `intent:${await intent("SALE")}`,
          })
        ).id;
        const fin = await ok(`finance/sales/${sale}`);
        const pa = await op(
            "COLLECT",
            {
              sourceJournalId: fin.journal.id,
              accountId: fin.journal.accountId,
              fundAccountId: cash,
              method: "CASH",
              amount: "3000",
            },
            a.headers,
          ),
          pb = await op(
            "COLLECT",
            {
              sourceJournalId: fin.journal.id,
              accountId: fin.journal.accountId,
              fundAccountId: cash,
              method: "CASH",
              amount: "3000",
            },
            b.headers,
          );
        const res = await Promise.all([
          request("finance/collect", "POST", pa, a.headers),
          request("finance/collect", "POST", pb, b.headers),
        ]);
        assert.deepEqual(res.map((r) => r.status).sort(), [200, 409]);
        assert.equal(
          new Decimal((await ok(`finance/sales/${sale}`)).outstanding).toFixed(
            2,
          ),
          "1800.00",
        );
        await ok("finance/reversals", "POST", {
          journalId: await journal(res.find((r) => r.status === 200)!.body.id),
          idempotencyKey: randomUUID(),
          bookedOn: "2026-10-26",
          reason: "K5 concurrency test correction",
        });
        await ok("finance/reversals", "POST", {
          journalId: fin.journal.id,
          idempotencyKey: randomUUID(),
          bookedOn: "2026-10-26",
          reason: "K5 duplicate synthetic sale correction",
        });
      },
    );
    await check(
      "expired step-up rejects finance write; real TOTP step-up recovers; nonfinance staff sees no balances",
      async () => {
        const p = await op(
            "COLLECT",
            {
              sourceJournalId: saleJ,
              accountId,
              fundAccountId: cash,
              method: "CASH",
              amount: "1",
            },
            a.headers,
          ),
          before = await financialCounts();
        await admin.query(
          'UPDATE "AuthSession" SET "stepUpAt"=now()-interval \'1 hour\' WHERE "userId"=$1',
          [a.userId],
        );
        assert.equal(
          (await request("finance/collect", "POST", p, a.headers)).status,
          403,
        );
        assert.deepEqual(await financialCounts(), before);
        await a.stepUp();
        const outsider = await k5Staff(
          f,
          admin,
          c.tenantId,
          scope.legalEntityId,
          ["sales.view"],
        );
        for (const path of [
          "finance/accounts",
          "finance/funds",
          `finance/${accountId}/statement`,
        ])
          assert.equal(
            (await request(path, "GET", undefined, outsider.headers)).status,
            403,
          );
      },
    );
    await check(
      "end-of-day report reconciles every journal posting allocation and cash movement",
      async () => {
        const s = await summary();
        for (const [key, delta] of Object.entries({
          netSales: 4000,
          salesVat: 800,
          grossSales: 4800,
          collections: 4800,
          payments: 800,
          expensesNet: 1500,
          expensesVat: 200,
          expensesGross: 1700,
          payables: 900,
          cashMovement: 4000,
          cash: 4000,
        }))
          assert.equal(
            new Decimal(s[key]).minus(initial[key]).toFixed(2),
            new Decimal(delta).toFixed(2),
            key,
          );
        const ledger = (
          await admin.query(
            `SELECT a.kind,sum(p.debit-p.credit)::text balance FROM "FinancePosting" p JOIN "FinanceJournal" j ON j.id=p."journalId" JOIN "FinanceAccount" a ON a.id=p."accountId" WHERE j."tenantId"=$1 AND j."legalEntityId"=$2 AND j."activityId" IS NULL AND j."bookedOn"='2026-10-26' GROUP BY a.kind`,
            [c.tenantId, scope.legalEntityId],
          )
        ).rows;
        const totals = Object.fromEntries(
          ledger.map((r) => [r.kind, new Decimal(r.balance).toFixed(2)]),
        );
        assert.equal(totals.REVENUE, "-4000.00");
        assert.equal(totals.VAT, "-800.00");
        assert.equal(totals.EXPENSE, "1500.00");
        assert.equal(totals.INPUT_VAT, "200.00");
        assert.equal(totals.CASH, "4000.00");
        assert.equal(totals.SUPPLIER, "-900.00");
        assert.equal(
          (
            await admin.query(
              'SELECT count(*)::int n FROM (SELECT "journalId" FROM "FinancePosting" GROUP BY "journalId" HAVING sum(debit-credit)<>0) x',
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (await admin.query('SELECT count(*)::int n FROM "StockMovement"'))
            .rows[0].n,
          stockBefore,
        );
        await writeFile(
          resolve(
            `.data/fixtures/v42-${process.env.PUSULA_LOCAL_FIXTURE}/k5-business-verification.json`,
          ),
          JSON.stringify(
            {
              status: "PASS",
              checks: checks + 1,
              net: "4000.00",
              vat: "800.00",
              gross: "4800.00",
              collections: "4800.00",
              cashDelta: "4000.00",
              supplierOutstanding: "900.00",
              physicalStockConsumed: false,
              twoDistinctAuthenticatedStaff: true,
              ledger: totals,
            },
            null,
            2,
          ),
        );
      },
    );
  } finally {
    await admin.end();
    await f.close();
  }
}
main().catch((e) => {
  console.error("K5_BUSINESS_FAILED", e?.name, e?.message);
  process.exitCode = 1;
});
