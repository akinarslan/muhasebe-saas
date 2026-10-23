import "server-only";
import type { Tx } from "../catalog";
import Decimal from "decimal.js";
import { AccessError } from "@/server/authorization/context";

export async function command(
  tx: Tx,
  action: "ACCOUNT" | "OPENING" | "REVERSE",
  input: object,
) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT public.k1_command(${action},${JSON.stringify(input)}::jsonb) id`;
  return { id: rows[0].id };
}

export async function statement(tx: Tx, accountId: string, through: string) {
  const accounts = await tx.$queryRaw<
    { id: string; kind: string; currency: string }[]
  >`
    SELECT id,kind,currency FROM public."FinanceAccount" WHERE id=${accountId}::uuid AND kind IN ('CUSTOMER','SUPPLIER')`;
  if (!accounts.length) throw new AccessError(404, "NOT_FOUND");
  const rows = await tx.$queryRaw<
    {
      id: string;
      bookedOn: string;
      dueOn: string | null;
      debit: string;
      credit: string;
      reversesId: string | null;
      reason: string;
    }[]
  >`SELECT j.id,j."bookedOn"::text "bookedOn",j."dueOn"::text "dueOn",
    p.debit::text debit,p.credit::text credit,j."reversesId",j.reason
    FROM public."FinancePosting" p JOIN public."FinanceJournal" j ON j.id=p."journalId"
    WHERE p."accountId"=${accountId}::uuid AND j."bookedOn"<=${through}::date
    ORDER BY j."bookedOn",j."createdAt",j.id LIMIT 1001`;
  if (rows.length > 1000)
    throw new AccessError(422, "RESULT_LIMIT_NARROW_FILTER");
  let running = new Decimal(0);
  const entries = rows.map((r) => {
    const delta = new Decimal(r.debit).minus(r.credit);
    running = running.plus(
      accounts[0].kind === "SUPPLIER" ? delta.negated() : delta,
    );
    return { ...r, balance: running.toFixed(2) };
  });
  return {
    account: accounts[0],
    through,
    balance: running.toFixed(2),
    entries,
  };
}
