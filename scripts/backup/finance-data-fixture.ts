// Synthetic nonempty finance records for the guarded local backup fixture only.
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { requireCheck } from "./core";
export async function seedBackupFinance(db: Client) {
  const identity = (
    await db.query(
      "SELECT current_database() db,current_user actor,current_setting('data_directory') directory",
    )
  ).rows[0];
  requireCheck(
    identity.db === "pusula_backup_fixture" &&
      identity.actor === "fixture_admin" &&
      /[\\/]\.data[\\/]fixtures[\\/]e23-[a-f0-9-]{36}[\\/]data$/i.test(
        identity.directory,
      ),
    "BACKUP_FINANCE_SEED_TARGET_REJECTED",
  );
  async function insert(table: string, row: Record<string, unknown>) {
    const keys = Object.keys(row);
    await db.query(
      `INSERT INTO "${table}"(${keys.map((k) => `"${k}"`).join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
      Object.values(row),
    );
  }
  const customers = (
    await db.query(
      'SELECT id,"tenantId","legalEntityId","createdById" FROM "Customer" ORDER BY id',
    )
  ).rows;
  const user = (await db.query('SELECT id FROM "AuthUser" ORDER BY id LIMIT 1'))
    .rows[0].id;
  await db.query("BEGIN");
  try {
    for (const c of customers) {
      const scope = {
        tenantId: c.tenantId,
        legalEntityId: c.legalEntityId,
        activityId: null,
        createdById: user,
      };
      const ids = {
        party: randomUUID(),
        equity: randomUUID(),
        cash: randomUUID(),
        expense: randomUUID(),
        vat: randomUUID(),
      };
      for (const [name, id] of Object.entries(ids))
        await insert("FinanceAccount", {
          ...scope,
          id,
          kind: {
            party: "CUSTOMER",
            equity: "EQUITY",
            cash: "CASH",
            expense: "EXPENSE",
            vat: "INPUT_VAT",
          }[name],
          customerId: name === "party" ? c.id : null,
          currency: "TRY",
        });
      await insert("FinanceAccountAccess", {
        ...scope,
        accountId: ids.cash,
        userId: user,
      });
      const opening = randomUUID(),
        collection = randomUUID(),
        expense = randomUUID();
      for (const [id, accountId, count] of [
        [opening, ids.party, 2],
        [collection, ids.party, 2],
        [expense, ids.expense, 3],
      ] as const)
        await insert("FinanceJournal", {
          ...scope,
          id,
          accountId,
          sourceKey: `synthetic-backup:${id}`,
          requestKey: randomUUID(),
          payloadHash: "a".repeat(64),
          bookedOn: "2026-10-23",
          reason: "Synthetic backup verification",
          postingCount: count,
        });
      for (const [journalId, accountId, debit, credit] of [
        [opening, ids.party, "500.00", "0"],
        [opening, ids.equity, "0", "500.00"],
        [collection, ids.cash, "200.00", "0"],
        [collection, ids.party, "0", "200.00"],
        [expense, ids.expense, "60.00", "0"],
        [expense, ids.vat, "12.00", "0"],
        [expense, ids.cash, "0", "72.00"],
      ])
        await insert("FinancePosting", {
          ...scope,
          journalId,
          accountId,
          debit,
          credit,
        });
      for (const kind of ["COLLECT", "EXPENSE"]) {
        const intentId = randomUUID(),
          operationId = randomUUID(),
          journalId = kind === "COLLECT" ? collection : expense;
        await insert("FinanceIntent", {
          ...scope,
          id: intentId,
          kind,
          closed: true,
          clientKey: randomUUID(),
        });
        await insert("FinanceOperation", {
          ...scope,
          id: operationId,
          kind,
          intentId,
          requestKey: randomUUID(),
          payloadHash: "b".repeat(64),
          economicKey: `synthetic-backup:${operationId}`,
          journalId,
          accountId: kind === "COLLECT" ? ids.party : ids.expense,
          fundAccountId: ids.cash,
          sourceJournalId: kind === "COLLECT" ? opening : null,
          amount: kind === "COLLECT" ? "200.00" : "72.00",
          fee: "0",
          externalRef: "synthetic-backup",
          method: "CASH",
          terminalApproved: false,
          bookedOn: "2026-10-23",
          dueOn: null,
          reason: "Synthetic backup verification",
        });
        await insert("FinanceFundMovement", {
          ...scope,
          operationId,
          accountId: ids.cash,
          amount: kind === "COLLECT" ? "200.00" : "-72.00",
        });
        if (kind === "COLLECT")
          await insert("FinanceAllocation", {
            ...scope,
            operationId,
            sourceJournalId: opening,
            amount: "200.00",
          });
        else
          await insert("FinanceExpense", {
            ...scope,
            operationId,
            journalId,
            category: "OTHER",
            description: "Synthetic backup expense",
            documentRef: "SYNTHETIC-ONLY",
            bookedOn: "2026-10-23",
            net: "60.00",
            vat: "12.00",
            payment: "CASH",
          });
      }
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}
