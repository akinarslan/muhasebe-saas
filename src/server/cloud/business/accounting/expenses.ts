import "server-only";
import type { Tx } from "../catalog";
import { AccessError } from "@/server/authorization/context";

export async function createExpense(tx: Tx, input: object) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT public.k4_expense(${JSON.stringify(input)}::jsonb) id`;
  return rows[0];
}
export async function expenseList(tx: Tx, from: string, through: string) {
  const rows = await tx.$queryRaw<unknown[]>`
    SELECT x.id,x.category,x.description,x."documentRef",x."supplierId",x."bookedOn"::text,x."dueOn"::text,
      x.net::text,x.vat::text,(x.net+x.vat)::text gross,x.payment,x."journalId",o."accountId",
      CASE WHEN EXISTS(SELECT 1 FROM "FinanceJournal" r WHERE r."reversesId"=x."journalId" AND r."bookedOn"<=${through}::date) THEN 'REVERSED'
        WHEN x.payment<>'CREDIT' THEN 'PAID'
        WHEN coalesce((SELECT sum(a.amount) FROM "FinanceAllocation" a JOIN "FinanceOperation" p ON p.id=a."operationId" WHERE a."sourceJournalId"=x."journalId" AND p."bookedOn"<=${through}::date),0)>=x.net+x.vat THEN 'PAID'
        ELSE 'UNPAID' END status,
      CASE WHEN x.payment<>'CREDIT' OR EXISTS(SELECT 1 FROM "FinanceJournal" r WHERE r."reversesId"=x."journalId" AND r."bookedOn"<=${through}::date) THEN 0
        ELSE x.net+x.vat-coalesce((SELECT sum(a.amount) FROM "FinanceAllocation" a JOIN "FinanceOperation" p ON p.id=a."operationId" WHERE a."sourceJournalId"=x."journalId" AND p."bookedOn"<=${through}::date),0) END::text outstanding
    FROM "FinanceExpense" x JOIN "FinanceOperation" o ON o.id=x."operationId"
    WHERE x."bookedOn" BETWEEN ${from}::date AND ${through}::date ORDER BY x."bookedOn" DESC,x.id LIMIT 201`;
  if (rows.length > 200)
    throw new AccessError(422, "RESULT_LIMIT_NARROW_FILTER");
  return rows;
}

export async function financeSummary(tx: Tx, from: string, through: string) {
  const rows = await tx.$queryRaw<{ result: unknown }[]>`
    WITH ledger AS (
      SELECT p.debit,p.credit,a.kind,a.id,j."bookedOn",j."saleId",j."reversesId",j.id jid,
        orig."saleId" original_sale
      FROM "FinancePosting" p JOIN "FinanceAccount" a ON a.id=p."accountId"
      JOIN "FinanceJournal" j ON j.id=p."journalId" LEFT JOIN "FinanceJournal" orig ON orig.id=j."reversesId"
      WHERE j."bookedOn"<=${through}::date
    ), balances AS (
      SELECT id,kind,sum(debit-credit) amount FROM ledger GROUP BY id,kind
    ), operations AS (
      SELECT o.*,coalesce(orig.kind,o.kind) effective_kind,CASE WHEN o.kind='REVERSE' THEN -1 ELSE 1 END sign
      FROM "FinanceOperation" o LEFT JOIN "FinanceOperation" orig ON orig.id=o."reversesId"
      WHERE o."bookedOn" BETWEEN ${from}::date AND ${through}::date
    ), expense_entries AS (
      SELECT l.* FROM ledger l WHERE EXISTS(SELECT 1 FROM "FinanceExpense" x WHERE x."journalId"=l.jid OR x."journalId"=l."reversesId")
    ) SELECT jsonb_build_object(
      'from',${from}::text,'through',${through}::text,
      'netSales',coalesce((SELECT sum(credit-debit) FROM ledger WHERE kind='REVENUE' AND ("saleId" IS NOT NULL OR original_sale IS NOT NULL) AND "bookedOn">=${from}::date),0)::text,
      'salesVat',coalesce((SELECT sum(credit-debit) FROM ledger WHERE kind='VAT' AND ("saleId" IS NOT NULL OR original_sale IS NOT NULL) AND "bookedOn">=${from}::date),0)::text,
      'grossSales',coalesce((SELECT sum(debit-credit) FROM ledger WHERE kind='CUSTOMER' AND ("saleId" IS NOT NULL OR original_sale IS NOT NULL) AND "bookedOn">=${from}::date),0)::text,
      'collections',coalesce((SELECT sum(sign*amount) FROM operations WHERE effective_kind='COLLECT'),0)::text,
      'payments',coalesce((SELECT sum(sign*amount) FROM operations WHERE effective_kind='PAY' OR (effective_kind='EXPENSE' AND "fundAccountId" IS NOT NULL)),0)::text,
      'cash',coalesce((SELECT sum(amount) FROM balances WHERE kind='CASH'),0)::text,
      'bank',coalesce((SELECT sum(amount) FROM balances WHERE kind='BANK'),0)::text,
      'pos',coalesce((SELECT sum(amount) FROM balances WHERE kind='POS'),0)::text,
      'receivables',coalesce((SELECT sum(greatest(amount,0)) FROM balances WHERE kind='CUSTOMER'),0)::text,
      'payables',coalesce((SELECT sum(greatest(-amount,0)) FROM balances WHERE kind='SUPPLIER'),0)::text,
      'overdue',coalesce((SELECT sum(greatest(p.debit-p.credit-coalesce((SELECT sum(x.amount) FROM "FinanceAllocation" x JOIN "FinanceOperation" o ON o.id=x."operationId" WHERE x."sourceJournalId"=j.id AND o."bookedOn"<=${through}::date),0),0))
        FROM "FinanceJournal" j JOIN "FinanceAccount" a ON a.id=j."accountId" JOIN "FinancePosting" p ON p."journalId"=j.id AND p."accountId"=a.id
        WHERE a.kind='CUSTOMER' AND j."reversesId" IS NULL AND (j."saleId" IS NOT NULL OR j."sourceKey" LIKE 'OPENING:%') AND j."dueOn"<${through}::date AND j."bookedOn"<=${through}::date
        AND NOT EXISTS(SELECT 1 FROM "FinanceJournal" r WHERE r."reversesId"=j.id AND r."bookedOn"<=${through}::date)),0)::text,
      'expensesNet',coalesce((SELECT sum(debit-credit) FROM expense_entries WHERE kind='EXPENSE' AND "bookedOn">=${from}::date),0)::text,
      'expensesVat',coalesce((SELECT sum(debit-credit) FROM expense_entries WHERE kind='INPUT_VAT' AND "bookedOn">=${from}::date),0)::text,
      'expensesGross',coalesce((SELECT sum(debit-credit) FROM expense_entries WHERE kind IN ('EXPENSE','INPUT_VAT') AND "bookedOn">=${from}::date),0)::text,
      'monthlyExpensesNet',coalesce((SELECT sum(debit-credit) FROM expense_entries WHERE kind='EXPENSE' AND "bookedOn">=date_trunc('month',${through}::date)::date),0)::text,
      'cashMovement',coalesce((SELECT sum(debit-credit) FROM ledger WHERE kind IN ('CASH','BANK') AND "bookedOn">=${from}::date AND NOT EXISTS(SELECT 1 FROM "FinanceOperation" o LEFT JOIN "FinanceOperation" orig ON orig.id=o."reversesId" WHERE o."journalId"=ledger.jid AND coalesce(orig.kind,o.kind)='OPEN')),0)::text,
      'estimatedJobProfit',coalesce((SELECT sum((s."netTry"-round(s."costUsd"*(s."rateSnapshot"->>'value')::numeric,2))*CASE WHEN l."reversesId" IS NULL THEN 1 ELSE -1 END)
        FROM ledger l JOIN "CloudSale" s ON s.id=coalesce(l."saleId",l.original_sale) WHERE l.kind='REVENUE' AND l."bookedOn">=${from}::date),0)::text
    ) result`;
  return rows[0].result;
}
