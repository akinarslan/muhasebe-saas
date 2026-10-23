import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { masterFixture } from "../auth/master-fixture";
import { cloudRequest } from "../../src/server/cloud/handler";
import { contextFor, scoped } from "../../src/server/authorization/context";
import { command } from "../../src/server/cloud/business/accounting/ledger";
import { requireLocalAccounting } from "../../src/server/cloud/business/accounting/accounts";

async function main() {
  requireLocalAccounting();
  const f = await masterFixture();
  const admin = new Client({
    connectionString: process.env.TEST_DIRECT_DATABASE_URL,
  });
  await admin.connect();
  let n = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    await fn();
    console.log(`PASS ${++n}: ${name}`);
  };
  try {
    const c = await contextFor(f.headers(), f.db, f.source);
    const boot = await f.source.db.authBootstrap.findFirstOrThrow();
    const scope = { legalEntityId: boot.legalEntityId, activityId: null };
    const request = async (
      path: string,
      method = "GET",
      body?: object,
      through = "2026-10-29",
    ) => {
      const r = await cloudRequest(
        new Request(
          `http://127.0.0.1:3000/api/cloud/workspace/${path}${method === "GET" ? `?company=${scope.legalEntityId}&through=${through}` : ""}`,
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
    const ok = async (path: string, method = "GET", body?: object) => {
      const r = await request(path, method, body);
      assert.equal(r.status, 200, JSON.stringify(r));
      return r.body;
    };
    const customer = await ok("customers", "POST", {
      idempotencyKey: randomUUID(),
      name: "K1 synthetic customer",
    });
    const supplier = await ok("suppliers", "POST", {
      idempotencyKey: randomUUID(),
      name: "K1 synthetic supplier",
      defaultCurrency: "TRY",
      leadTimeDays: 0,
    });
    const account = await ok("finance/accounts", "POST", {
      kind: "CUSTOMER",
      partyId: customer.id,
    });
    const payable = await ok("finance/accounts", "POST", {
      kind: "SUPPLIER",
      partyId: supplier.id,
    });
    const payload = {
      accountId: account.id,
      idempotencyKey: randomUUID(),
      amount: "0.30",
      currency: "TRY",
      bookedOn: "2026-10-22",
      dueOn: "2026-10-29",
      reason: "Synthetic opening",
    };
    let journal = "";
    await check("party links and account creation replay", async () => {
      assert.deepEqual(
        await ok("finance/accounts", "POST", {
          kind: "CUSTOMER",
          partyId: customer.id,
        }),
        account,
      );
      assert.equal((await ok("finance/accounts")).length, 2);
    });
    await check("opening concurrently replays one journal", async () => {
      const rows = await Promise.all([
        ok("finance/openings", "POST", payload),
        ok("finance/openings", "POST", payload),
      ]);
      assert.equal(rows[0].id, rows[1].id);
      journal = rows[0].id;
    });
    await check("statement dates due dates and exact Decimal", async () => {
      const s = await ok(`finance/${account.id}/statement`);
      assert.equal(s.balance, "0.30");
      assert.equal(s.entries[0].dueOn, "2026-10-29");
      const p = (
        await admin.query(
          'SELECT sum(debit-credit)::text delta,count(*)::int n FROM "FinancePosting" WHERE "journalId"=$1',
          [journal],
        )
      ).rows[0];
      assert.equal(p.delta, "0.00");
      assert.equal(p.n, 2);
    });
    await check(
      "same key different payload rejected without amount disclosure",
      async () => {
        const r = await request("finance/openings", "POST", {
          ...payload,
          amount: "99.99",
        });
        assert.equal(r.status, 409);
        assert.ok(!JSON.stringify(r.body).includes("99.99"));
      },
    );
    await check(
      "second source even with new request key rejected",
      async () => {
        assert.equal(
          (
            await request("finance/openings", "POST", {
              ...payload,
              idempotencyKey: randomUUID(),
            })
          ).status,
          409,
        );
      },
    );
    await check(
      "supplier payable sign and negative customer balance retained",
      async () => {
        await ok("finance/openings", "POST", {
          ...payload,
          accountId: payable.id,
          amount: "123.45",
          idempotencyKey: randomUUID(),
        });
        assert.equal(
          (await ok(`finance/${payable.id}/statement`)).balance,
          "123.45",
        );
        const nc = await ok("customers", "POST", {
          idempotencyKey: randomUUID(),
          name: "K1 credit customer",
        });
        const na = await ok("finance/accounts", "POST", {
          kind: "CUSTOMER",
          partyId: nc.id,
        });
        await ok("finance/openings", "POST", {
          ...payload,
          accountId: na.id,
          amount: "-10.01",
          idempotencyKey: randomUUID(),
        });
        assert.equal(
          (await ok(`finance/${na.id}/statement`)).balance,
          "-10.01",
        );
      },
    );
    await check(
      "transaction rollback removes journal postings and audit",
      async () => {
        const counts = async () =>
          (
            await admin.query(`SELECT
          (SELECT count(*)::int FROM "FinanceJournal") journals,
          (SELECT count(*)::int FROM "FinancePosting") postings,
          (SELECT count(*)::int FROM "AuditEvent" WHERE action LIKE 'finance.%') audits`)
          ).rows[0];
        const before = await counts();
        await assert.rejects(
          scoped(
            c,
            async (tx) => {
              await tx.$queryRaw`SELECT set_config('app.activity_id','',true)`;
              await command(tx, "REVERSE", {
                journalId: journal,
                idempotencyKey: randomUUID(),
                bookedOn: "2026-10-22",
                reason: "Rollback test",
              });
              throw Error("ROLLBACK_TEST");
            },
            f.db,
            scope.legalEntityId,
          ),
          /ROLLBACK_TEST/,
        );
        assert.deepEqual(await counts(), before);
      },
    );
    await check(
      "authorized reversal immutable original and exactly once",
      async () => {
        const reverse = {
          journalId: journal,
          idempotencyKey: randomUUID(),
          bookedOn: "2026-10-22",
          reason: "Synthetic correction",
        };
        const r = await ok("finance/reversals", "POST", reverse);
        assert.equal((await ok("finance/reversals", "POST", reverse)).id, r.id);
        assert.equal(
          (
            await request("finance/reversals", "POST", {
              ...reverse,
              idempotencyKey: randomUUID(),
            })
          ).status,
          409,
        );
        assert.equal(
          (await ok(`finance/${account.id}/statement`)).balance,
          "0.00",
        );
        assert.equal(
          (
            await admin.query(
              'SELECT count(*)::int n FROM "FinancePosting" WHERE "journalId"=$1',
              [journal],
            )
          ).rows[0].n,
          2,
        );
      },
    );
    await check(
      "as-of excludes later entries and zero opening is exact",
      async () => {
        const r = await request(
          `finance/${payable.id}/statement`,
          "GET",
          undefined,
          "2026-10-21",
        );
        assert.equal(r.body.balance, "0.00");
        assert.equal(r.body.entries.length, 0);
        const nc = await ok("customers", "POST", {
          idempotencyKey: randomUUID(),
          name: "K1 zero opening",
        });
        const a = await ok("finance/accounts", "POST", {
          kind: "CUSTOMER",
          partyId: nc.id,
        });
        await ok("finance/openings", "POST", {
          ...payload,
          accountId: a.id,
          idempotencyKey: randomUUID(),
          amount: "0",
        });
        assert.equal((await ok(`finance/${a.id}/statement`)).balance, "0.00");
      },
    );
    await check(
      "runtime direct DML and executor membership rejected",
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
              "SELECT pg_has_role('pusula_test_runtime','pusula_finance_executor','SET') allowed",
            )
          ).rows[0].allowed,
          false,
        );
        assert.equal(
          (
            await admin.query(
              "SELECT has_function_privilege('public','k1_command(text,jsonb)','EXECUTE') allowed",
            )
          ).rows[0].allowed,
          false,
        );
      },
    );
    await check("append-only applies even to administrative SQL", async () => {
      await assert.rejects(
        admin.query('UPDATE "FinanceJournal" SET reason=$1 WHERE id=$2', [
          "tampered",
          journal,
        ]),
        /FINANCE_IMMUTABLE/,
      );
      await assert.rejects(
        admin.query('DELETE FROM "FinanceAccount" WHERE id=$1', [account.id]),
        /FINANCE_IMMUTABLE/,
      );
    });
    await check(
      "wrong tenant entity activity and unauthenticated RLS empty",
      async () => {
        for (const change of [
          { tenantId: randomUUID() },
          { userId: randomUUID() },
        ]) {
          const rows = await scoped(
            { ...c, ...change },
            (tx) => tx.$queryRaw<unknown[]>`SELECT * FROM "FinanceJournal"`,
            f.db,
            scope.legalEntityId,
          );
          assert.equal(rows.length, 0);
        }
        for (const entity of [randomUUID(), scope.legalEntityId]) {
          const rows = await scoped(
            c,
            async (tx) => {
              await tx.$queryRaw`SELECT set_config('app.activity_id',${randomUUID()},true)`;
              return tx.$queryRaw<unknown[]>`SELECT * FROM "FinanceAccount"`;
            },
            f.db,
            entity,
          );
          assert.equal(rows.length, 0);
        }
      },
    );
    await check(
      "MASTER explicit DENY hides financial data at API and RLS",
      async () => {
        const sid = randomUUID(),
          oid = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind) VALUES($1,$2,\'TENANT\')',
          [sid, c.tenantId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,\'finance.accounts\',\'DENY\',$4)',
          [oid, c.tenantId, c.membershipId, sid],
        );
        try {
          assert.equal(
            (await request(`finance/${account.id}/statement`)).status,
            403,
          );
          const rows = await scoped(
            c,
            (tx) => tx.$queryRaw<unknown[]>`SELECT * FROM "FinancePosting"`,
            f.db,
            scope.legalEntityId,
          );
          assert.equal(rows.length, 0);
        } finally {
          await admin.query(
            'DELETE FROM "UserPermissionOverride" WHERE id=$1',
            [oid],
          );
        }
      },
    );
    await check(
      "invalid precision currency and due date rejected",
      async () => {
        for (const change of [
          { amount: 0.3 },
          { amount: "1.001" },
          { currency: "USD" },
          { dueOn: "2026-10-21" },
        ])
          assert.equal(
            (
              await request("finance/openings", "POST", {
                ...payload,
                ...change,
              })
            ).status,
            400,
          );
      },
    );
    await check(
      "unbalanced journal fails at deferred commit atomically",
      async () => {
        const id = randomUUID();
        await admin.query("BEGIN");
        try {
          await admin.query(
            `INSERT INTO "FinanceJournal"(id,"tenantId","legalEntityId","activityId","createdById","accountId","sourceKey","requestKey","payloadHash","bookedOn",reason)
          SELECT $1,"tenantId","legalEntityId","activityId","createdById","accountId",$2,$3,'test',"bookedOn",'Unbalanced synthetic test' FROM "FinanceJournal" WHERE id=$4`,
            [id, `test:${id}`, randomUUID(), journal],
          );
          await admin.query(
            `INSERT INTO "FinancePosting"("tenantId","legalEntityId","activityId","createdById","journalId","accountId",debit,credit)
          SELECT "tenantId","legalEntityId","activityId","createdById",$1,"accountId",debit,CASE WHEN credit>0 THEN credit+0.01 ELSE credit END FROM "FinancePosting" WHERE "journalId"=$2`,
            [id, journal],
          );
          await assert.rejects(admin.query("COMMIT"), /FINANCE_UNBALANCED/);
        } finally {
          await admin.query("ROLLBACK");
        }
        assert.equal(
          (
            await admin.query(
              'SELECT count(*)::int n FROM "FinanceJournal" WHERE id=$1',
              [id],
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await check(
      "read access alone cannot approve finance writes at API or SQL",
      async () => {
        const sid = randomUUID(),
          oid = randomUUID();
        await admin.query(
          'INSERT INTO "PermissionScope"(id,"tenantId",kind) VALUES($1,$2,\'TENANT\')',
          [sid, c.tenantId],
        );
        await admin.query(
          'INSERT INTO "UserPermissionOverride"(id,"tenantId","membershipId","permissionId",effect,"scopeId") VALUES($1,$2,$3,\'finance.approve\',\'DENY\',$4)',
          [oid, c.tenantId, c.membershipId, sid],
        );
        try {
          assert.equal((await request("finance/accounts")).status, 200);
          assert.equal(
            (await request("finance/openings", "POST", payload)).status,
            403,
          );
          await assert.rejects(
            scoped(
              c,
              (tx) => command(tx, "OPENING", payload),
              f.db,
              scope.legalEntityId,
            ),
          );
        } finally {
          await admin.query(
            'DELETE FROM "UserPermissionOverride" WHERE id=$1',
            [oid],
          );
        }
      },
    );
    await check("wrong party and foreign entity account rejected", async () => {
      assert.equal(
        (
          await request("finance/accounts", "POST", {
            kind: "CUSTOMER",
            partyId: randomUUID(),
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request("finance/openings", "POST", {
            ...payload,
            accountId: randomUUID(),
            idempotencyKey: randomUUID(),
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request("finance/accounts", "POST", {
            kind: "CUSTOMER",
            partyId: customer.id,
            legalEntityId: randomUUID(),
          })
        ).status,
        404,
      );
    });
    await check(
      "cloud gate rejects missing fixture and remote target before context",
      async () => {
        const oldId = process.env.PUSULA_LOCAL_FIXTURE,
          oldUrl = process.env.TEST_DATABASE_URL;
        try {
          delete process.env.PUSULA_LOCAL_FIXTURE;
          assert.equal((await request("finance/accounts")).status, 503);
          process.env.PUSULA_LOCAL_FIXTURE = oldId;
          process.env.TEST_DATABASE_URL =
            "postgresql://synthetic:synthetic@example.invalid/pusula_sprint_b_test?sslmode=disable";
          assert.equal((await request("finance/accounts")).status, 503);
        } finally {
          process.env.PUSULA_LOCAL_FIXTURE = oldId;
          process.env.TEST_DATABASE_URL = oldUrl;
        }
      },
    );
    await check("missing step-up blocks mutation", async () => {
      await f.source.db.authSession.updateMany({ data: { stepUpAt: null } });
      assert.equal(
        (
          await request("finance/reversals", "POST", {
            journalId: journal,
            idempotencyKey: randomUUID(),
            bookedOn: "2026-10-22",
            reason: "No step up",
          })
        ).status,
        403,
      );
    });
    await check("single migration history stays sixteen", async () => {
      assert.equal(
        (
          await admin.query(
            "SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
          )
        ).rows[0].n,
        16,
      );
    });
  } finally {
    await admin.end();
    await f.close();
  }
}
main().catch(() => {
  console.error(
    "ACCOUNTING_FIXTURE_FAILED (see named completed checks; payloads suppressed)",
  );
  process.exitCode = 1;
});
