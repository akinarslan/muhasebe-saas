import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { Client } from "pg";
import { masterFixture } from "../auth/master-fixture";
import { cloudRequest } from "../../src/server/cloud/handler";
import { contextFor, scoped } from "../../src/server/authorization/context";
import { requireLocalAccounting } from "../../src/server/cloud/business/accounting/accounts";
import { provisionIdentity, authRequest } from "../../src/server/auth/core";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
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
      h = f.headers(),
    ) => {
      const res = await cloudRequest(
        new Request(
          `http://127.0.0.1:3000/api/cloud/workspace/${path}${path.includes("?") ? "&" : "?"}company=${scope.legalEntityId}&through=2026-10-29`,
          {
            method,
            headers: h,
            ...(body ? { body: JSON.stringify({ ...scope, ...body }) } : {}),
          },
        ),
        f.db,
        f.source,
      );
      return { status: res.status, body: await res.json() };
    };
    const ok = async (path: string, method = "GET", body?: object) => {
      const r = await request(path, method, body);
      assert.equal(r.status, 200, JSON.stringify({ path, ...r }));
      return r.body;
    };
    const intent = async (kind: string, key = randomUUID()) =>
      (await ok("finance/intents", "POST", { kind, clientKey: key }))
        .id as string;
    const operation = async (kind: string, extra: object) => ({
      intentId: await intent(kind),
      idempotencyKey: randomUUID(),
      currency: "TRY",
      amount: "0",
      fee: "0",
      bookedOn: "2026-10-22",
      reason: "K3 synthetic operation",
      ...extra,
    });
    const balance = async (id: string) =>
      new Decimal(
        (await ok("finance/funds")).find((x: { id: string }) => x.id === id)
          .balance,
      ).toFixed(2);
    const outstanding = async (id: string, party = "CUSTOMER") =>
      new Decimal(
        (await ok(`finance/documents?party=${party}`)).find(
          (x: { journalId: string }) => x.journalId === id,
        ).outstanding,
      ).toFixed(2);
    const counts = async () =>
      (
        await admin.query(
          `SELECT (SELECT count(*)::int FROM "FinanceOperation") ops,(SELECT count(*)::int FROM "FinanceAllocation") allocations,(SELECT count(*)::int FROM "FinanceFundMovement") movements,(SELECT count(*)::int FROM "FinanceJournal") journals,(SELECT count(*)::int FROM "FinancePosting") postings,(SELECT count(*)::int FROM "AuditEvent" WHERE action<>'finance.k3.intent') audits`,
        )
      ).rows[0];
    const cash = (
      await ok("finance/funds", "POST", { kind: "CASH", label: "K3 cash" })
    ).id;
    const bank = (
      await ok("finance/funds", "POST", { kind: "BANK", label: "K3 bank" })
    ).id;
    const pos = (
      await ok("finance/funds", "POST", { kind: "POS", label: "K3 POS" })
    ).id;
    await check(
      "fund openings and distinct cash bank POS balances",
      async () => {
        for (const [id, amount] of [
          [cash, "0"],
          [bank, "10000"],
          [pos, "0"],
        ])
          await ok(
            "finance/fund-opening",
            "POST",
            await operation("OPEN", {
              fundAccountId: id,
              amount,
              bookedOn: "2026-10-01",
            }),
          );
        assert.equal(await balance(cash), "0.00");
        assert.equal(await balance(bank), "10000.00");
        assert.equal(await balance(pos), "0.00");
      },
    );
    const customer = await ok("customers", "POST", {
      idempotencyKey: randomUUID(),
      name: "K3 synthetic buyer",
    });
    const product = await ok("products", "POST", {
      idempotencyKey: randomUUID(),
      name: "K3 service",
      kind: "service",
      unit: "adet",
    });
    const rateRes = await cloudRequest(
      new Request("http://127.0.0.1:3000/api/cloud/exchange-rate", {
        method: "POST",
        headers: f.headers(),
        body: JSON.stringify({ usdTry: "40", reason: "K3 synthetic rate" }),
      }),
      f.db,
      f.source,
    );
    assert.equal(rateRes.status, 201);
    const rate = await rateRes.json();
    const saleData = {
      customerId: customer.id,
      date: "2026-10-22",
      dueDate: "2026-10-29",
      currency: "TRY",
      notes: "K3 synthetic 12000 sale",
      rate: { kind: "manual", id: rate.id },
      plans: [],
      lines: [
        {
          productId: product.id,
          description: "K3 service",
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
    };
    const sale = async () => {
      const iid = await intent("SALE");
      const r = await ok("sales", "POST", {
        ...saleData,
        idempotencyKey: randomUUID(),
        sourceRef: `intent:${iid}`,
      });
      const fin = await ok(`finance/sales/${r.id}`);
      return {
        saleId: r.id,
        journalId: fin.journal.id,
        accountId: fin.journal.accountId,
        intentId: iid,
      };
    };
    const first = await sale();
    let collectJournal = "";
    await check(
      "12000 sale partial5000 leaves7000 and final7000 leaves0",
      async () => {
        const r = await ok(
          "finance/collect",
          "POST",
          await operation("COLLECT", {
            sourceJournalId: first.journalId,
            accountId: first.accountId,
            fundAccountId: cash,
            method: "CASH",
            amount: "5000",
          }),
        );
        collectJournal = (
          await admin.query(
            'SELECT "journalId" FROM "FinanceOperation" WHERE id=$1',
            [r.id],
          )
        ).rows[0].journalId;
        assert.equal(await outstanding(first.journalId), "7000.00");
        assert.equal(await balance(cash), "5000.00");
        await ok(
          "finance/collect",
          "POST",
          await operation("COLLECT", {
            sourceJournalId: first.journalId,
            fundAccountId: bank,
            method: "BANK",
            externalRef: "K3-EFT-7000",
            amount: "7000",
          }),
        );
        assert.equal(await outstanding(first.journalId), "0.00");
        assert.equal(await balance(bank), "17000.00");
      },
    );
    const second = await sale();
    const card = await operation("COLLECT", {
      sourceJournalId: second.journalId,
      fundAccountId: pos,
      method: "CARD",
      terminalApproved: true,
      externalRef: "K3-TERMINAL-1",
      amount: "1000",
    });
    let cardJ = "",
      settleJ = "";
    await check(
      "same economic intent replays across keys and outcome is queryable",
      async () => {
        const r = await ok("finance/collect", "POST", card);
        const before = await counts();
        assert.equal((await ok("finance/collect", "POST", card)).id, r.id);
        assert.equal(
          (
            await ok("finance/collect", "POST", {
              ...card,
              idempotencyKey: randomUUID(),
            })
          ).id,
          r.id,
        );
        assert.deepEqual(await counts(), before);
        const outcome = await ok(`finance/outcome/${card.intentId}`);
        assert.equal(outcome.state, "SUCCEEDED");
        assert.equal(outcome.id, r.id);
        cardJ = outcome.journalId;
        const unused = await intent("COLLECT");
        assert.equal(
          (await ok(`finance/outcome/${unused}`)).state,
          "NOT_COMMITTED",
        );
        const duplicate = await operation("COLLECT", {
          ...card,
          intentId: unused,
          idempotencyKey: randomUUID(),
        });
        assert.equal(
          (await request("finance/collect", "POST", duplicate)).status,
          409,
        );
        assert.deepEqual(await counts(), before);
      },
    );
    await check(
      "card remains POS pending until gross fee net bank settlement",
      async () => {
        assert.equal(await balance(pos), "1000.00");
        assert.equal(await balance(bank), "17000.00");
        const settle = await operation("SETTLE", {
          sourceJournalId: cardJ,
          fundAccountId: bank,
          amount: "1000",
          fee: "20",
          externalRef: "K3-SETTLEMENT-1",
        });
        const r = await ok("finance/settle", "POST", settle);
        settleJ = (
          await admin.query(
            'SELECT "journalId" FROM "FinanceOperation" WHERE id=$1',
            [r.id],
          )
        ).rows[0].journalId;
        assert.equal(await balance(pos), "0.00");
        assert.equal(await balance(bank), "17980.00");
        assert.equal(await outstanding(second.journalId), "11000.00");
        const rows = (
          await admin.query(
            'SELECT a.kind,p.debit::text,p.credit::text FROM "FinancePosting" p JOIN "FinanceAccount" a ON a.id=p."accountId" WHERE p."journalId"=$1 ORDER BY a.kind',
            [settleJ],
          )
        ).rows;
        assert.deepEqual(rows, [
          { kind: "BANK", debit: "980.00", credit: "0.00" },
          { kind: "COMMISSION", debit: "20.00", credit: "0.00" },
          { kind: "POS", debit: "0.00", credit: "1000.00" },
        ]);
      },
    );
    const supplier = await ok("suppliers", "POST", {
      idempotencyKey: randomUUID(),
      name: "K3 supplier",
      defaultCurrency: "TRY",
      leadTimeDays: 0,
    });
    const ap = (
      await ok("finance/accounts", "POST", {
        kind: "SUPPLIER",
        partyId: supplier.id,
      })
    ).id;
    let debtJ = "",
      payJ = "";
    await check(
      "approved8000 supplier debt partial3000 payment leaves5000",
      async () => {
        const debt = await ok(
          "finance/debt",
          "POST",
          await operation("DEBT", {
            accountId: ap,
            amount: "8000",
            dueOn: "2026-10-29",
            externalRef: "K3-INVOICE-8000",
          }),
        );
        debtJ = (
          await admin.query(
            'SELECT "journalId" FROM "FinanceOperation" WHERE id=$1',
            [debt.id],
          )
        ).rows[0].journalId;
        const pay = await ok(
          "finance/pay",
          "POST",
          await operation("PAY", {
            sourceJournalId: debtJ,
            accountId: ap,
            fundAccountId: bank,
            method: "BANK",
            amount: "3000",
            externalRef: "K3-SUPPLIER-EFT",
          }),
        );
        payJ = (
          await admin.query(
            'SELECT "journalId" FROM "FinanceOperation" WHERE id=$1',
            [pay.id],
          )
        ).rows[0].journalId;
        assert.equal(await outstanding(debtJ, "SUPPLIER"), "5000.00");
        assert.equal(await balance(bank), "14980.00");
        assert.equal(
          (
            await request(
              "finance/pay",
              "POST",
              await operation("PAY", {
                sourceJournalId: randomUUID(),
                fundAccountId: bank,
                method: "BANK",
                amount: "1",
              }),
            )
          ).status,
          409,
        );
      },
    );
    await check(
      "reversal requires dependent settlement first and restores allocations",
      async () => {
        const reverse = async (journalId: string) =>
          ok("finance/reversals", "POST", {
            journalId,
            idempotencyKey: randomUUID(),
            bookedOn: "2026-10-23",
            reason: "K3 correction",
          });
        assert.equal(
          (
            await request("finance/reversals", "POST", {
              journalId: cardJ,
              idempotencyKey: randomUUID(),
              bookedOn: "2026-10-23",
              reason: "Too early reversal",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("finance/reversals", "POST", {
              journalId: first.journalId,
              idempotencyKey: randomUUID(),
              bookedOn: "2026-10-23",
              reason: "Allocated sale reversal",
            })
          ).status,
          409,
        );
        await reverse(settleJ);
        assert.equal(await balance(pos), "1000.00");
        await reverse(cardJ);
        assert.equal(await balance(pos), "0.00");
        assert.equal(await outstanding(second.journalId), "12000.00");
        await reverse(payJ);
        assert.equal(await outstanding(debtJ, "SUPPLIER"), "8000.00");
        await reverse(collectJournal);
        assert.equal(await balance(cash), "0.00");
        assert.equal(await outstanding(first.journalId), "5000.00");
      },
    );
    const concurrentSale = await sale();
    await check(
      "concurrent8000 collections cannot exceed12000 source",
      async () => {
        const a = await operation("COLLECT", {
            sourceJournalId: concurrentSale.journalId,
            fundAccountId: cash,
            method: "CASH",
            amount: "8000",
          }),
          b = await operation("COLLECT", {
            sourceJournalId: concurrentSale.journalId,
            fundAccountId: cash,
            method: "CASH",
            amount: "8000",
          });
        const rows = await Promise.all([
          request("finance/collect", "POST", a),
          request("finance/collect", "POST", b),
        ]);
        assert.deepEqual(rows.map((x) => x.status).sort(), [200, 409]);
        assert.equal(await outstanding(concurrentSale.journalId), "4000.00");
      },
    );
    await check(
      "cash bank negative and overpayment are rejected atomically",
      async () => {
        const before = await counts();
        const p = await operation("PAY", {
          sourceJournalId: debtJ,
          fundAccountId: cash,
          method: "CASH",
          amount: "8000.01",
        });
        assert.equal((await request("finance/pay", "POST", p)).status, 409);
        assert.deepEqual(await counts(), before);
        const d = await ok(
          "finance/debt",
          "POST",
          await operation("DEBT", {
            accountId: ap,
            amount: "50000",
            externalRef: "K3-LARGE-INVOICE",
          }),
        );
        const j = (
          await admin.query(
            'SELECT "journalId" FROM "FinanceOperation" WHERE id=$1',
            [d.id],
          )
        ).rows[0].journalId;
        for (const fundAccountId of [cash, bank]) {
          const start = await counts();
          assert.equal(
            (
              await request(
                "finance/pay",
                "POST",
                await operation("PAY", {
                  sourceJournalId: j,
                  fundAccountId,
                  method: fundAccountId === cash ? "CASH" : "BANK",
                  amount: "40000",
                  externalRef: "K3-INSUFFICIENT-" + fundAccountId,
                }),
              )
            ).status,
            409,
          );
          assert.deepEqual(await counts(), start);
        }
      },
    );
    await check(
      "allocation write failure rolls back every financial record",
      async () => {
        const payload = await operation("COLLECT", {
          sourceJournalId: concurrentSale.journalId,
          fundAccountId: bank,
          method: "BANK",
          amount: "1",
          externalRef: "K3-FAIL",
        });
        const before = await counts();
        await admin.query(
          'REVOKE INSERT ON "FinanceAllocation" FROM pusula_finance_executor',
        );
        try {
          assert.equal(
            (await request("finance/collect", "POST", payload)).status,
            409,
          );
        } finally {
          await admin.query(
            'GRANT INSERT ON "FinanceAllocation" TO pusula_finance_executor',
          );
        }
        assert.deepEqual(await counts(), before);
      },
    );
    await check(
      "method terminal card data and wrong party scope rejected",
      async () => {
        const base = await operation("COLLECT", {
          sourceJournalId: second.journalId,
          fundAccountId: pos,
          method: "CARD",
          amount: "1",
        });
        assert.equal(
          (await request("finance/collect", "POST", base)).status,
          409,
        );
        assert.equal(
          (
            await request("finance/collect", "POST", {
              ...base,
              cardNumber: "FORBIDDEN",
              cvv: "FORBIDDEN",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request("finance/collect", "POST", {
              ...base,
              method: "CASH",
              fundAccountId: cash,
              accountId: ap,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("finance/collect", "POST", {
              ...base,
              method: "CASH",
              fundAccountId: cash,
              activityId: randomUUID(),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request("finance/collect", "POST", {
              ...base,
              method: "CASH",
              fundAccountId: cash,
              legalEntityId: randomUUID(),
            })
          ).status,
          404,
        );
        for (const change of [
          { tenantId: randomUUID() },
          { userId: randomUUID() },
        ]) {
          const r = await scoped(
            { ...c, ...change },
            (tx) => tx.$queryRaw<unknown[]>`SELECT * FROM "FinanceOperation"`,
            f.db,
            scope.legalEntityId,
          );
          assert.equal(r.length, 0);
        }
      },
    );
    await check(
      "non-master assigned funds and action permissions are mandatory",
      async () => {
        const password = "Synthetic-" + randomUUID(),
          email = `k3-staff-${randomUUID()}@example.invalid`;
        const user = await provisionIdentity(() =>
          f.source.auth.api.signUpEmail({
            body: { email, password, name: "K3 restricted collector" },
          }),
        );
        const membership = randomUUID(),
          sid = randomUUID(),
          role = "K3_" + randomUUID();
        await admin.query(
          "INSERT INTO \"Role\"(id,name) VALUES($1,'K3 collector')",
          [role],
        );
        for (const permission of [
          "finance.accounts",
          "finance.collect",
          "finance.cash",
          "sales.view",
        ])
          await admin.query(
            'INSERT INTO "RolePermission"("roleId","permissionId") VALUES($1,$2)',
            [role, permission],
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
        const headers = new Headers({
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
          cookie: login.headers
            .getSetCookie()
            .map((s) => s.split(";")[0])
            .join("; "),
          "x-pusula-membership": membership,
        });
        assert.equal(
          (await request("finance/funds", "GET", undefined, headers)).body
            .length,
          0,
        );
        await ok("finance/access", "POST", {
          fundAccountId: cash,
          userId: user.user.id,
          grant: true,
        });
        assert.deepEqual(
          (await request("finance/funds", "GET", undefined, headers)).body.map(
            (x: { id: string }) => x.id,
          ),
          [cash],
        );
        const staffIntent = await request(
          "finance/intents",
          "POST",
          { kind: "COLLECT", clientKey: randomUUID() },
          headers,
        );
        assert.equal(staffIntent.status, 403); // no MFA
        const cookies = new Map(
          headers
            .get("cookie")!
            .split("; ")
            .map((v) => [
              v.slice(0, v.indexOf("=")),
              v.slice(v.indexOf("=") + 1),
            ]),
        );
        const staffCall = async (path: string, body: object) => {
          const r = await authRequest(
            new Request("http://127.0.0.1:3000/api/auth" + path, {
              method: "POST",
              headers,
              body: JSON.stringify(body),
            }),
            f.source,
          );
          for (const raw of r.headers.getSetCookie()) {
            const part = raw.split(";")[0],
              i = part.indexOf("=");
            cookies.set(part.slice(0, i), part.slice(i + 1));
          }
          headers.set(
            "cookie",
            [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          );
          assert.equal(r.status, 200);
          return r;
        };
        await staffCall("/two-factor/enable", { password });
        const factor = await f.source.db.authTwoFactor.findUniqueOrThrow({
          where: { userId: user.user.id },
        });
        const secret = await symmetricDecrypt({
          key: process.env.AUTH_TEST_SECRET!,
          data: factor.secret,
        });
        await staffCall("/two-factor/verify-totp", {
          code: await createOTP(secret).totp(),
        });
        await staffCall("/step-up", {
          password,
          code: await createOTP(secret).totp(),
        });
        const iid = (
          await request(
            "finance/intents",
            "POST",
            { kind: "COLLECT", clientKey: randomUUID() },
            headers,
          )
        ).body.id;
        const payload = {
          ...(await operation("COLLECT", {
            sourceJournalId: second.journalId,
            fundAccountId: cash,
            method: "CASH",
            amount: "1",
          })),
          intentId: iid,
        };
        assert.equal(
          (await request("finance/collect", "POST", payload, headers)).status,
          200,
        );
        assert.equal(
          (
            await request(
              "finance/pay",
              "POST",
              { ...payload, fundAccountId: bank },
              headers,
            )
          ).status,
          403,
        );
        const denied = randomUUID();
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,\'finance.cash\',\'DENY\',$4)',
          [denied, c.tenantId, membership, sid],
        );
        assert.equal(
          (await request("finance/funds", "GET", undefined, headers)).body
            .length,
          0,
        );
        const before = await counts();
        assert.equal(
          (
            await request(
              "finance/collect",
              "POST",
              { ...payload, idempotencyKey: randomUUID() },
              headers,
            )
          ).status,
          409,
        );
        assert.deepEqual(await counts(), before);
        await admin.query('DELETE FROM "UserPermissionOverride" WHERE id=$1', [
          denied,
        ]);
        await admin.query(
          'DELETE FROM "RolePermission" WHERE "roleId"=$1 AND "permissionId"=\'finance.collect\'',
          [role],
        );
        const ownScope = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'OWN\',$3)',
          [ownScope, c.tenantId, scope.legalEntityId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,\'finance.collect\',\'ALLOW\',$4)',
          [randomUUID(), c.tenantId, membership, ownScope],
        );
        const ownIntent = await request(
          "finance/intents",
          "POST",
          { kind: "COLLECT", clientKey: randomUUID() },
          headers,
        );
        assert.equal(ownIntent.status, 200);
        const beforeOwn = await counts();
        assert.equal(
          (
            await request(
              "finance/collect",
              "POST",
              {
                ...payload,
                intentId: ownIntent.body.id,
                idempotencyKey: randomUUID(),
              },
              headers,
            )
          ).status,
          409,
        );
        assert.deepEqual(await counts(), beforeOwn);
      },
    );
    await check(
      "runtime immutability ACL and master explicit DENY",
      async () => {
        const denyPayload = await operation("COLLECT", {
          sourceJournalId: second.journalId,
          fundAccountId: cash,
          method: "CASH",
          amount: "1",
        });
        await assert.rejects(
          scoped(
            c,
            (tx) => tx.$executeRaw`DELETE FROM "FinanceAllocation"`,
            f.db,
            scope.legalEntityId,
          ),
        );
        assert.equal(
          (
            await admin.query(
              "SELECT has_function_privilege('public','k3_command(text,jsonb)','EXECUTE') allowed",
            )
          ).rows[0].allowed,
          false,
        );
        const sid = randomUUID(),
          oid = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind) VALUES($1,$2,\'TENANT\')',
          [sid, c.tenantId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,\'finance.collect\',\'DENY\',$4)',
          [oid, c.tenantId, c.membershipId, sid],
        );
        try {
          assert.equal(
            (await request("finance/collect", "POST", denyPayload)).status,
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
      "full supplier payment and closing unknown intents are safe",
      async () => {
        await ok(
          "finance/pay",
          "POST",
          await operation("PAY", {
            sourceJournalId: debtJ,
            fundAccountId: bank,
            method: "BANK",
            amount: "8000",
            externalRef: "K3-FULL-PAY",
          }),
        );
        assert.equal(await outstanding(debtJ, "SUPPLIER"), "0.00");
        const iid = await intent("COLLECT");
        await ok("finance/cancel-intent", "POST", { intentId: iid });
        assert.equal((await ok(`finance/outcome/${iid}`)).state, "CANCELLED");
        const late = await operation("COLLECT", {
          intentId: iid,
          sourceJournalId: second.journalId,
          fundAccountId: cash,
          method: "CASH",
          amount: "1",
        });
        const before = await counts();
        assert.equal(
          (await request("finance/collect", "POST", late)).status,
          409,
        );
        assert.deepEqual(await counts(), before);
        assert.equal(
          (
            await request("finance/cancel-intent", "POST", {
              intentId: card.intentId,
            })
          ).status,
          409,
        );
      },
    );
    await check(
      "backdated payout cannot consume future bank receipts",
      async () => {
        await ok(
          "finance/collect",
          "POST",
          await operation("COLLECT", {
            sourceJournalId: second.journalId,
            fundAccountId: bank,
            method: "BANK",
            amount: "5000",
            externalRef: "K3-FUTURE-EFT",
          }),
        );
        const debt = await ok(
          "finance/debt",
          "POST",
          await operation("DEBT", {
            accountId: ap,
            amount: "20000",
            bookedOn: "2026-10-01",
            externalRef: "K3-EARLY-DEBT",
          }),
        );
        const journal = (
          await admin.query(
            'SELECT "journalId" FROM "FinanceOperation" WHERE id=$1',
            [debt.id],
          )
        ).rows[0].journalId;
        assert(new Decimal(await balance(bank)).gt(11000));
        const payload = await operation("PAY", {
          sourceJournalId: journal,
          fundAccountId: bank,
          method: "BANK",
          amount: "11000",
          bookedOn: "2026-10-15",
          externalRef: "K3-BACKDATED-PAY",
        });
        const before = await counts();
        assert.equal(
          (await request("finance/pay", "POST", payload)).status,
          409,
        );
        assert.deepEqual(await counts(), before);
      },
    );
    await check(
      "catalog FORCE RLS count ownership and helper ACL are pinned",
      async () => {
        const catalog = (
          await admin.query(
            `SELECT count(*)::int tables,count(*) FILTER(WHERE c.relforcerowsecurity)::int forced FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'`,
          )
        ).rows[0];
        assert.deepEqual(
          catalog,
          process.env.PUSULA_EXPENSE_FIXTURE === "1"
            ? { tables: 56, forced: 42 }
            : { tables: 55, forced: 41 },
        );
        const owners = (
          await admin.query(
            `SELECT p.proname,pg_get_userbyid(p.proowner) owner,p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('k3_command','k3_outcome','k1_command','k2_post_sale')`,
          )
        ).rows;
        assert.equal(owners.length, 4);
        assert(
          owners.every(
            (x) =>
              x.owner === "pusula_finance_executor" && x.prosecdef === true,
          ),
        );
        const role = (
          await admin.query(
            "SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='pusula_finance_executor'",
          )
        ).rows[0];
        assert.deepEqual(role, {
          rolcanlogin: false,
          rolsuper: false,
          rolbypassrls: false,
        });
        for (const fn of [
          "k1_command_impl(text,jsonb)",
          "k2_post_sale_impl(uuid,text)",
        ])
          assert.equal(
            (
              await admin.query(
                "SELECT has_function_privilege('pusula_test_runtime',$1,'EXECUTE') allowed",
                [fn],
              )
            ).rows[0].allowed,
            false,
          );
        for (const table of [
          "FinanceIntent",
          "FinanceAccountAccess",
          "FinanceOperation",
          "FinanceAllocation",
          "FinanceFundMovement",
        ])
          assert.equal(
            (
              await admin.query(
                "SELECT has_table_privilege('pusula_test_runtime',$1,'INSERT,UPDATE,DELETE') allowed",
                ['\"' + table + '\"'],
              )
            ).rows[0].allowed,
            false,
          );
      },
    );
    await check(
      "MFA cloud gate and sixteen migration history remain sealed",
      async () => {
        await f.source.db.authSession.updateMany({
          where: { userId: c.userId },
          data: { stepUpAt: null },
        });
        assert.equal(
          (
            await request("finance/funds", "POST", {
              kind: "CASH",
              label: "No MFA",
            })
          ).status,
          403,
        );
        const old = process.env.PUSULA_LOCAL_FIXTURE;
        try {
          delete process.env.PUSULA_LOCAL_FIXTURE;
          assert.equal((await request("finance/funds")).status, 503);
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
  console.error("ACCOUNTING_K3_FIXTURE_FAILED", e?.name);
  console.error(
    JSON.stringify({
      frames:
        typeof e?.stack === "string"
          ? e.stack
              .split("\n")
              .filter((l: string) => l.includes("verify-k3.ts"))
              .slice(0, 2)
          : [],
    }),
  );
  process.exitCode = 1;
});
