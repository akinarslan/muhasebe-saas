import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { Client } from "pg";
import { masterFixture } from "../auth/master-fixture";
import { cloudRequest } from "../../src/server/cloud/handler";
import { contextFor, scoped } from "../../src/server/authorization/context";
import { requireLocalAccounting } from "../../src/server/cloud/business/accounting/accounts";
import { provisionIdentity, authRequest } from "../../src/server/auth/core";

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
    console.log(`PASS K4 ${++n}: ${name}`);
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
          `http://127.0.0.1:3000/api/cloud/workspace/${path}${path.includes("?") ? "&" : "?"}company=${scope.legalEntityId}`,
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
      assert.equal(r.status, 200, JSON.stringify({ path, ...r }));
      return r.body;
    };
    const intent = async (kind: string) =>
      (await ok("finance/intents", "POST", { kind, clientKey: randomUUID() }))
        .id;
    const operation = async (kind: string, extra: object) => ({
      intentId: await intent(kind),
      idempotencyKey: randomUUID(),
      currency: "TRY",
      amount: "0",
      fee: "0",
      bookedOn: "2026-10-23",
      reason: "K4 synthetic operation",
      ...extra,
    });
    const counts = async () =>
      (
        await admin.query(
          `SELECT (SELECT count(*)::int FROM "FinanceExpense") expenses,(SELECT count(*)::int FROM "FinanceOperation") ops,(SELECT count(*)::int FROM "FinanceAllocation") allocations,(SELECT count(*)::int FROM "FinanceFundMovement") movements,(SELECT count(*)::int FROM "FinanceJournal") journals,(SELECT count(*)::int FROM "FinancePosting") postings,(SELECT count(*)::int FROM "AuditEvent" WHERE action<>'finance.k3.intent') audits`,
        )
      ).rows[0];
    const summary = (from = "2026-10-23", through = from) =>
      ok(`finance/summary?from=${from}&through=${through}`);
    const journal = async (id: string) =>
      (
        await admin.query(
          'SELECT "journalId" FROM "FinanceOperation" WHERE id=$1',
          [id],
        )
      ).rows[0].journalId;
    const outstanding = async (jid: string) =>
      (await ok("finance/documents?party=SUPPLIER")).find(
        (x: { journalId: string }) => x.journalId === jid,
      ).outstanding;
    const cash = (
      await ok("finance/funds", "POST", { kind: "CASH", label: "K4 cash" })
    ).id;
    const customer = await ok("customers", "POST", {
      idempotencyKey: randomUUID(),
      name: "K4 synthetic buyer",
    });
    const product = await ok("products", "POST", {
      idempotencyKey: randomUUID(),
      name: "K4 service",
      kind: "service",
      unit: "adet",
    });
    const rateRes = await cloudRequest(
      new Request("http://127.0.0.1:3000/api/cloud/exchange-rate", {
        method: "POST",
        headers: f.headers(),
        body: JSON.stringify({ usdTry: "40", reason: "K4 synthetic rate" }),
      }),
      f.db,
      f.source,
    );
    assert.equal(rateRes.status, 201);
    const rate = await rateRes.json();
    const initial = await summary();
    const sale = await ok("sales", "POST", {
      customerId: customer.id,
      date: "2026-10-23",
      dueDate: "2026-10-24",
      currency: "TRY",
      notes: "K4 synthetic",
      rate: { kind: "manual", id: rate.id },
      plans: [],
      idempotencyKey: randomUUID(),
      sourceRef: `intent:${await intent("SALE")}`,
      lines: [
        {
          productId: product.id,
          description: "K4 service",
          quantity: 1,
          widthCm: 0,
          heightCm: 0,
          discount: 0,
          vat: 20,
          zeroCostConfirmed: true,
          costing: {
            materials: [],
            expenses: [],
            method: "margin",
            targetPercent: 50,
            manualNetUsd: 250,
            vat: 20,
          },
        },
      ],
    });
    const fin = await ok(`finance/sales/${sale.id}`);
    await ok(
      "finance/collect",
      "POST",
      await operation("COLLECT", {
        sourceJournalId: fin.journal.id,
        accountId: fin.journal.accountId,
        fundAccountId: cash,
        method: "CASH",
        amount: "12000",
      }),
    );
    const supplier = await ok("suppliers", "POST", {
      idempotencyKey: randomUUID(),
      name: "K4 synthetic supplier",
    });
    const expense = async (extra: object) => ({
      intentId: await intent("EXPENSE"),
      idempotencyKey: randomUUID(),
      currency: "TRY",
      category: "RENT",
      description: "K4 işletme gideri",
      documentRef: `K4-${randomUUID()}`,
      bookedOn: "2026-10-23",
      dueOn: null,
      net: "2500",
      vat: "500",
      supplierId: null,
      payment: "CASH",
      fundAccountId: cash,
      ...extra,
    });
    const cashBefore = (await summary()).cash;
    const before = await counts();
    const paidPayload = await expense({});
    let paidId = "",
      creditId = "",
      creditJ = "";
    await check(
      "3000 cash expense is one document and atomic cash outflow with net VAT split",
      async () => {
        paidId = (await ok("finance/expenses", "POST", paidPayload)).id;
        assert.equal((await counts()).expenses, before.expenses + 1);
        assert.equal(
          new Decimal(cashBefore).minus((await summary()).cash).toFixed(2),
          "3000.00",
        );
        const p = (
          await admin.query(
            'SELECT p.debit::text,p.credit::text,a.kind FROM "FinancePosting" p JOIN "FinanceAccount" a ON a.id=p."accountId" WHERE p."journalId"=$1',
            [await journal(paidId)],
          )
        ).rows;
        assert.equal(p.length, 3);
        assert.equal(p.find((x) => x.kind === "EXPENSE").debit, "2500.00");
        assert.equal(p.find((x) => x.kind === "INPUT_VAT").debit, "500.00");
      },
    );
    const creditPayload = await expense({
      category: "MAINTENANCE",
      supplierId: supplier.id,
      payment: "CREDIT",
      fundAccountId: null,
      dueOn: "2026-10-24",
      net: "5000",
      vat: "0",
    });
    await check(
      "5000 credit maintenance expense creates supplier liability without cash movement",
      async () => {
        const cash = (await summary()).cash;
        creditId = (await ok("finance/expenses", "POST", creditPayload)).id;
        creditJ = await journal(creditId);
        assert.equal(
          new Decimal(await outstanding(creditJ)).toFixed(2),
          "5000.00",
        );
        assert.equal((await summary()).cash, cash);
      },
    );
    const paymentIds: string[] = [];
    await check(
      "2000 partial then3000 final payments leave3000 then0 without a second expense",
      async () => {
        const count = (await counts()).expenses;
        for (const [amount, left] of [
          ["2000", "3000.00"],
          ["3000", "0.00"],
        ]) {
          paymentIds.push(
            (
              await ok(
                "finance/pay",
                "POST",
                await operation("PAY", {
                  sourceJournalId: creditJ,
                  fundAccountId: cash,
                  method: "CASH",
                  amount,
                }),
              )
            ).id,
          );
          assert.equal(
            new Decimal(await outstanding(creditJ)).toFixed(2),
            left,
          );
        }
        assert.equal((await counts()).expenses, count);
        const list = await ok(
          "finance/expenses?from=2026-10-23&through=2026-10-23",
        );
        assert.equal(
          list.find((x: { journalId: string }) => x.journalId === creditJ)
            .status,
          "PAID",
        );
      },
    );
    await check(
      "intent replay, changed payload, duplicate document and concurrent submissions cannot duplicate expense",
      async () => {
        const count = await counts();
        const results = await Promise.all([
          ok("finance/expenses", "POST", {
            ...paidPayload,
            idempotencyKey: randomUUID(),
          }),
          ok("finance/expenses", "POST", paidPayload),
        ]);
        assert(results.every((r) => r.id === paidId));
        assert.equal(
          (
            await request("finance/expenses", "POST", {
              ...paidPayload,
              net: "2600",
            })
          ).status,
          409,
        );
        const duplicate = await expense({
          documentRef: paidPayload.documentRef,
        });
        const countAfterIntent = await counts();
        assert.equal(
          (await request("finance/expenses", "POST", duplicate)).status,
          409,
        );
        assert.deepEqual(await counts(), countAfterIntent);
        assert.equal((await counts()).expenses, count.expenses);
        assert.equal(
          (await ok(`finance/outcome/${paidPayload.intentId}`)).state,
          "SUCCEEDED",
        );
      },
    );
    await check(
      "late financial failure and insufficient funds roll back every document posting movement audit",
      async () => {
        const payload = await expense({});
        const count = await counts();
        await admin.query(
          'REVOKE INSERT ON "FinanceFundMovement" FROM pusula_finance_executor',
        );
        try {
          assert.equal(
            (await request("finance/expenses", "POST", payload)).status,
            409,
          );
        } finally {
          await admin.query(
            'GRANT INSERT ON "FinanceFundMovement" TO pusula_finance_executor',
          );
        }
        assert.deepEqual(await counts(), count);
        assert.equal(
          (
            await request("finance/expenses", "POST", {
              ...payload,
              net: "99999999999999.99",
              vat: "0",
            })
          ).status,
          409,
        );
        assert.deepEqual(await counts(), count);
      },
    );
    await check(
      "daily summary reconciles12000 sales12000 collection8000 payments8000 gross expenses and independent journal sums",
      async () => {
        const r = await summary();
        for (const [key, delta] of Object.entries({
          netSales: 10000,
          salesVat: 2000,
          grossSales: 12000,
          collections: 12000,
          payments: 8000,
          expensesNet: 7500,
          expensesVat: 500,
          expensesGross: 8000,
          cashMovement: 4000,
          estimatedJobProfit: 10000,
        }))
          assert.equal(
            new Decimal(r[key]).minus(initial[key]).toFixed(2),
            new Decimal(delta).toFixed(2),
            key,
          );
        const ledger = (
          await admin.query(
            `SELECT coalesce(sum(p.debit-p.credit) FILTER(WHERE a.kind='EXPENSE'),0)::text net FROM "FinancePosting" p JOIN "FinanceAccount" a ON a.id=p."accountId" JOIN "FinanceJournal" j ON j.id=p."journalId" WHERE j."tenantId"=$1 AND j."legalEntityId"=$2 AND j."activityId" IS NULL AND j."bookedOn"='2026-10-23'`,
            [c.tenantId, scope.legalEntityId],
          )
        ).rows[0];
        assert.equal(
          new Decimal(r.expensesNet).toFixed(2),
          new Decimal(ledger.net).toFixed(2),
        );
      },
    );
    await check(
      "reversals belong to their booked period; active payments prevent debt reversal",
      async () => {
        assert.equal(
          (
            await request("finance/reversals", "POST", {
              journalId: creditJ,
              idempotencyKey: randomUUID(),
              bookedOn: "2026-10-24",
              reason: "K4 correction",
            })
          ).status,
          409,
        );
        const historic = await summary();
        const paidJ = await journal(paidId);
        await ok("finance/reversals", "POST", {
          journalId: await journal(paidId),
          idempotencyKey: randomUUID(),
          bookedOn: "2026-10-24",
          reason: "K4 cash expense correction",
        });
        assert.deepEqual(await summary(), historic);
        const next = await summary("2026-10-24");
        assert.equal(new Decimal(next.expensesNet).toFixed(2), "-2500.00");
        assert.equal(new Decimal(next.payments).toFixed(2), "-3000.00");
        assert.equal(
          (
            await ok("finance/expenses?from=2026-10-23&through=2026-10-24")
          ).find((x: { journalId: string }) => x.journalId === paidJ).status,
          "REVERSED",
        );
      },
    );
    await check(
      "reversing payments then debt restores liability and creates only inverse journals",
      async () => {
        const count = (await counts()).expenses;
        for (const id of paymentIds)
          await ok("finance/reversals", "POST", {
            journalId: await journal(id),
            idempotencyKey: randomUUID(),
            bookedOn: "2026-10-24",
            reason: "K4 payment correction",
          });
        assert.equal(
          new Decimal(await outstanding(creditJ)).toFixed(2),
          "5000.00",
        );
        await ok("finance/reversals", "POST", {
          journalId: creditJ,
          idempotencyKey: randomUUID(),
          bookedOn: "2026-10-24",
          reason: "K4 credit expense correction",
        });
        assert.equal(
          new Decimal(await outstanding(creditJ)).toFixed(2),
          "0.00",
        );
        assert.equal((await counts()).expenses, count);
      },
    );
    await check(
      "opening receivable is never sale income; overdue and reversal respect the as-of date",
      async () => {
        const party = await ok("customers", "POST", {
          idempotencyKey: randomUUID(),
          name: "K4 opening customer",
        });
        const account = await ok("finance/accounts", "POST", {
          kind: "CUSTOMER",
          partyId: party.id,
        });
        const before = await summary();
        const opening = await ok("finance/openings", "POST", {
          accountId: account.id,
          idempotencyKey: randomUUID(),
          currency: "TRY",
          amount: "100",
          bookedOn: "2026-10-23",
          dueOn: "2026-10-24",
          reason: "K4 prior period receivable",
        });
        const after = await summary();
        for (const key of [
          "netSales",
          "salesVat",
          "grossSales",
          "collections",
          "payments",
          "cashMovement",
        ])
          assert.equal(after[key], before[key], key);
        assert.equal(
          new Decimal(after.receivables).minus(before.receivables).toFixed(2),
          "100.00",
        );
        const late = await summary("2026-10-25");
        assert(new Decimal(late.overdue).gte(100));
        await ok("finance/reversals", "POST", {
          journalId: opening.id,
          idempotencyKey: randomUUID(),
          bookedOn: "2026-10-25",
          reason: "K4 opening correction",
        });
        assert.deepEqual(await summary(), after);
        assert.equal(
          new Decimal(late.overdue)
            .minus((await summary("2026-10-25")).overdue)
            .toFixed(2),
          "100.00",
        );
      },
    );
    await check(
      "no-session scope mismatch tenant company activity explicit DENY and runtime DML fail closed",
      async () => {
        assert.equal(
          (
            await request(
              "finance/expenses?from=2026-10-23&through=2026-10-23",
              "GET",
              undefined,
              new Headers(),
            )
          ).status,
          401,
        );
        const payload = await expense({});
        for (const [change, status] of [
          [{ legalEntityId: randomUUID() }, 404],
          [{ activityId: randomUUID() }, 403],
        ] as const)
          assert.equal(
            (
              await request("finance/expenses", "POST", {
                ...payload,
                ...change,
              })
            ).status,
            status,
          );
        for (const change of [
          { tenantId: randomUUID() },
          { userId: randomUUID() },
        ])
          assert.equal(
            (
              await scoped(
                { ...c, ...change },
                (tx) => tx.$queryRaw<unknown[]>`SELECT * FROM "FinanceExpense"`,
                f.db,
                scope.legalEntityId,
              )
            ).length,
            0,
          );
        await assert.rejects(
          scoped(
            c,
            (tx) => tx.$executeRaw`DELETE FROM "FinanceExpense"`,
            f.db,
            scope.legalEntityId,
          ),
        );
        const sid = randomUUID(),
          oid = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind) VALUES($1,$2,\'TENANT\')',
          [sid, c.tenantId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,\'finance.payables\',\'DENY\',$4)',
          [oid, c.tenantId, c.membershipId, sid],
        );
        try {
          assert.equal(
            (await request("finance/expenses", "POST", payload)).status,
            403,
          );
          assert.equal(
            (
              await request(
                "finance/summary?from=2026-10-23&through=2026-10-23",
              )
            ).status,
            403,
          );
          assert.equal(
            (await request(`finance/outcome/${paidPayload.intentId}`)).status,
            409,
          );
          assert.equal(
            (
              await request("finance/cancel-intent", "POST", {
                intentId: paidPayload.intentId,
              })
            ).status,
            409,
          );
        } finally {
          await admin.query(
            'DELETE FROM "UserPermissionOverride" WHERE id=$1',
            [oid],
          );
        }
        assert.equal(
          (await ok(`finance/outcome/${paidPayload.intentId}`)).state,
          "SUCCEEDED",
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,\'materials.costView\',\'DENY\',$4)',
          [oid, c.tenantId, c.membershipId, sid],
        );
        try {
          assert.equal(
            (
              await request(
                "finance/summary?from=2026-10-23&through=2026-10-23",
              )
            ).status,
            403,
          );
        } finally {
          await admin.query(
            'DELETE FROM "UserPermissionOverride" WHERE id=$1',
            [oid],
          );
        }
      },
    );
    await check(
      "real non-finance session cannot read expenses reports balances or create an expense",
      async () => {
        const email = `k4-viewer-${randomUUID()}@example.invalid`,
          password = `Synthetic-${randomUUID()}`;
        const user = await provisionIdentity(() =>
          f.source.auth.api.signUpEmail({
            body: { email, password, name: "K4 restricted viewer" },
          }),
        );
        const membership = randomUUID(),
          sid = randomUUID(),
          role = `K4_${randomUUID()}`;
        await admin.query(
          "INSERT INTO \"Role\"(id,name) VALUES($1,'K4 viewer')",
          [role],
        );
        await admin.query(
          'INSERT INTO "RolePermission"("roleId","permissionId") VALUES($1,\'sales.view\')',
          [role],
        );
        await admin.query(
          'INSERT INTO "Membership"(id,"tenantId","userId") VALUES($1,$2,$3)',
          [membership, c.tenantId, user.user.id],
        );
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'LEGAL_ENTITY\',$3)',
          [sid, c.tenantId, scope.legalEntityId],
        );
        await admin.query(
          'INSERT INTO "RoleAssignment"(id,"tenantId","membershipId","roleId","scopeId") VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), c.tenantId, membership, role, sid],
        );
        const login = await authRequest(
          new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "http://127.0.0.1:3000",
            },
            body: JSON.stringify({ email, password }),
          }),
          f.source,
        );
        assert.equal(login.status, 200);
        const headers = new Headers({
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
          "x-pusula-membership": membership,
          cookie: login.headers
            .getSetCookie()
            .map((s) => s.split(";")[0])
            .join("; "),
        });
        for (const path of [
          "finance/expenses?from=2026-10-23&through=2026-10-23",
          "finance/summary?from=2026-10-23&through=2026-10-23",
          "finance/funds",
        ]) {
          const r = await request(path, "GET", undefined, headers);
          assert.equal(r.status, 403);
          assert(!("cash" in r.body));
        }
        assert.equal(
          (await request("finance/expenses", "POST", paidPayload, headers))
            .status,
          403,
        );
      },
    );
    await check(
      "fixture-only gate MFA dates decimal categories cancellation and no public EXECUTE",
      async () => {
        const payload = await expense({});
        const financialCounts = await counts();
        assert.equal(
          (
            await request("finance/openings", "POST", {
              accountId: cash,
              idempotencyKey: randomUUID(),
              currency: "TRY",
              amount: "100",
              bookedOn: "2026-10-23",
              dueOn: null,
              reason: "Must use treasury opening",
            })
          ).status,
          409,
        );
        assert.deepEqual(await counts(), financialCounts);
        for (const change of [
          { net: 3000 },
          { net: "1e3" },
          { vat: "0.001" },
          { category: "STOCK_PURCHASE" },
          { bookedOn: "2026-02-30" },
        ])
          assert.equal(
            (
              await request("finance/expenses", "POST", {
                ...payload,
                ...change,
              })
            ).status,
            400,
          );
        await ok("finance/cancel-intent", "POST", {
          intentId: payload.intentId,
        });
        assert.equal(
          (await request("finance/expenses", "POST", payload)).status,
          409,
        );
        assert.equal(
          (
            await admin.query(
              "SELECT has_function_privilege('public','k4_expense(jsonb)','EXECUTE') allowed",
            )
          ).rows[0].allowed,
          false,
        );
        await admin.query(
          'UPDATE "AuthSession" SET "stepUpAt"=NULL WHERE "userId"=$1',
          [c.userId],
        );
        assert.equal(
          (await request("finance/expenses", "POST", payload)).status,
          403,
        );
        const old = process.env.PUSULA_LOCAL_FIXTURE;
        try {
          delete process.env.PUSULA_LOCAL_FIXTURE;
          assert.equal(
            (
              await request(
                "finance/summary?from=2026-10-23&through=2026-10-23",
              )
            ).status,
            503,
          );
        } finally {
          process.env.PUSULA_LOCAL_FIXTURE = old;
        }
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
main().catch((e) => {
  console.error("ACCOUNTING_K4_FIXTURE_FAILED", e?.name, e?.message);
  process.exitCode = 1;
});
