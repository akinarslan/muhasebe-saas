import "server-only";
import { z } from "zod";
import { database } from "@/server/db/client";
import { localFixtureTarget } from "@/server/db/local-fixture";
import { identity } from "@/server/auth/core";
import {
  contextFor,
  scoped,
  authorize,
  requireStepUp,
  AccessError,
} from "@/server/authorization/context";
import * as C from "@/lib/cloud/accounting-contracts";
import { resource, validateScope } from "../catalog";
import { command, statement } from "./ledger";
import { saleFinance } from "./sales";
import * as T from "@/lib/cloud/treasury-contracts";
import { treasuryCommand, treasuryRead } from "./treasury";
import { expenseCreate, financeRange } from "@/lib/cloud/expense-contracts";
import { createExpense, expenseList, financeSummary } from "./expenses";

export function requireLocalAccounting() {
  try {
    if (
      !localFixtureTarget(
        new URL(process.env.TEST_DATABASE_URL ?? ""),
        true,
        false,
      )
    )
      throw Error();
  } catch {
    throw new AccessError(503, "ACCOUNTING_CLOUD_REVIEW_REQUIRED");
  }
}

export async function accountingRequest(
  headers: Headers,
  path: string[],
  method: string,
  input: unknown,
  query: URLSearchParams,
  db = database(),
  source = identity(),
) {
  requireLocalAccounting();
  const c = await contextFor(headers, db, source);
  const s = z
    .object({
      legalEntityId: z.uuid(),
      activityId: z.uuid().nullable().default(null),
    })
    .parse(
      method === "GET"
        ? {
            legalEntityId: query.get("company"),
            activityId: query.get("activity") || null,
          }
        : input,
    );
  const [kind, id, sub] = path;
  const r = resource(c, s);
  authorize(c, "finance.accounts", r);
  if (method === "POST") {
    if (!["intents", "cancel-intent", "collect", "pay"].includes(id))
      authorize(c, "finance.approve", r);
    if (id === "collect") authorize(c, "finance.collect", r);
    if (id === "pay") authorize(c, "finance.pay", r);
    await requireStepUp(headers, source);
  }
  try {
    return await scoped(
      c,
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.activity_id',${s.activityId ?? ""},true),set_config('lock_timeout','3s',true),set_config('statement_timeout','10s',true)`;
        await validateScope(tx, c, s);
        if (kind !== "finance") throw new AccessError(404, "NOT_FOUND");
        if (path.length === 2 && ["expenses", "summary"].includes(id)) {
          authorize(c, "finance.payables", r);
          if (method === "POST" && id === "expenses")
            return createExpense(tx, expenseCreate.parse(input));
          if (method === "GET") {
            const range = financeRange.parse({
              from: query.get("from"),
              through: query.get("through"),
            });
            if (id === "expenses")
              return expenseList(tx, range.from, range.through);
            // A scope-wide report must not silently become an OWN-only partial total.
            for (const permission of [
              "reports.finance",
              "finance.accounts",
              "finance.approve",
              "finance.payables",
              "finance.cash",
              "finance.bank",
              "sales.view",
              "materials.costView",
            ]) {
              authorize(c, permission, r);
              authorize(c, permission, { ...r, createdById: undefined });
            }
            return financeSummary(tx, range.from, range.through);
          }
        }
        if (
          method === "GET" &&
          path.length <= 3 &&
          ["funds", "documents", "outcome"].includes(id)
        ) {
          if (id === "documents" && query.get("party") === "SUPPLIER")
            authorize(c, "finance.payables", r);
          return treasuryRead(
            tx,
            id === "documents"
              ? query.get("party") === "SUPPLIER"
                ? "PAYABLES"
                : "RECEIVABLES"
              : id.toUpperCase(),
            sub ? z.uuid().parse(sub) : null,
          );
        }
        if (method === "GET" && id === "sales" && sub && path.length === 3) {
          authorize(c, "sales.view", r);
          return saleFinance(
            tx,
            z.uuid().parse(sub),
            C.accountingDate.parse(
              query.get("through") ?? new Date().toISOString().slice(0, 10),
            ),
          );
        }
        if (method === "GET" && id === "accounts" && !sub) {
          const rows = await tx.$queryRaw<
            unknown[]
          >`SELECT id,kind,"customerId","supplierId",currency FROM public."FinanceAccount" WHERE kind IN ('CUSTOMER','SUPPLIER') ORDER BY id LIMIT 201`;
          if (rows.length > 200)
            throw new AccessError(422, "RESULT_LIMIT_NARROW_FILTER");
          return rows;
        }
        if (
          method === "GET" &&
          id &&
          sub === "statement" &&
          path.length === 3
        ) {
          return statement(
            tx,
            z.uuid().parse(id),
            C.accountingDate.parse(
              query.get("through") ?? new Date().toISOString().slice(0, 10),
            ),
          );
        }
        if (method === "POST" && path.length === 2) {
          if (id === "intents")
            return treasuryCommand(tx, "INTENT", T.intentCreate.parse(input));
          if (id === "cancel-intent")
            return treasuryCommand(
              tx,
              "CLOSE",
              z
                .object({
                  legalEntityId: z.uuid(),
                  activityId: z.uuid().nullable(),
                  intentId: z.uuid(),
                })
                .strict()
                .parse(input),
            );
          if (id === "funds")
            return treasuryCommand(tx, "FUND", T.fundCreate.parse(input));
          if (id === "access")
            return treasuryCommand(tx, "ACCESS", T.fundAccess.parse(input));
          const commands: Record<string, string> = {
            "fund-opening": "OPEN",
            debt: "DEBT",
            collect: "COLLECT",
            pay: "PAY",
            settle: "SETTLE",
          };
          if (commands[id])
            return treasuryCommand(
              tx,
              commands[id],
              T.treasuryOperation.parse(input),
            );
          if (id === "accounts")
            return command(tx, "ACCOUNT", C.accountCreate.parse(input));
          if (id === "openings")
            return command(tx, "OPENING", C.openingCreate.parse(input));
          if (id === "reversals")
            return command(tx, "REVERSE", C.reversalCreate.parse(input));
        }
        throw new AccessError(404, "NOT_FOUND");
      },
      db,
      s.legalEntityId,
    );
  } catch (error) {
    if (error instanceof AccessError || error instanceof z.ZodError)
      throw error;
    // Do not return SQL, identifiers, bind values or financial payloads to clients/logs.
    throw new AccessError(409, "FINANCE_COMMAND_REJECTED");
  }
}
