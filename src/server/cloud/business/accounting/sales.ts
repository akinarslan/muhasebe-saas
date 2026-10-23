import "server-only";
import type { Tx } from "../catalog";
import { AccessError } from "@/server/authorization/context";
import { statement } from "./ledger";

export async function postSale(tx: Tx, saleId: string, sourceKey: string) {
  try {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT public.k2_post_sale(${saleId}::uuid,${sourceKey}) id`;
    return rows[0].id;
  } catch {
    throw new AccessError(409, "SALE_FINANCE_REJECTED");
  }
}

export async function saleFinance(tx: Tx, saleId: string, through: string) {
  const sales = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "CloudSale" WHERE id=${saleId}::uuid
    AND "activityId" IS NOT DISTINCT FROM nullif(current_setting('app.activity_id',true),'')::uuid
    AND pusula_can('finance.accounts',"tenantId","legalEntityId","activityId","createdById")`;
  if (!sales.length) throw new AccessError(404, "NOT_FOUND");
  const rows = await tx.$queryRaw<
    {
      id: string;
      accountId: string;
      netTry: string;
      vatTry: string;
      grossTry: string;
      reversalId: string | null;
    }[]
  >`SELECT j.id,j."accountId",j."netTry"::text "netTry",j."vatTry"::text "vatTry",j."grossTry"::text "grossTry",r.id "reversalId"
    FROM "FinanceJournal" j LEFT JOIN "FinanceJournal" r ON r."reversesId"=j.id WHERE j."saleId"=${saleId}::uuid`;
  if (!rows.length) return { saleId, status: "LEGACY_UNPOSTED" };
  return {
    saleId,
    outstanding: (
      await tx.$queryRaw<
        { value: string }[]
      >`SELECT public.k3_due(${rows[0].id}::uuid)::text value`
    )[0].value,
    status: rows[0].reversalId ? "REVERSED" : "POSTED",
    journal: rows[0],
    statement: await statement(tx, rows[0].accountId, through),
  };
}
