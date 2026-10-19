import "server-only";
import { catalogRequest } from "./business/catalog";
import { supplierRequest } from "./business/suppliers";
import { documentRequest } from "./business/documents";
import { importRequest } from "./business/imports";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { database } from "@/server/db/client";
import { identity } from "@/server/auth/core";
import {
  AccessError,
  contextFor,
  scoped,
} from "@/server/authorization/context";
import {
  listUsers,
  changeUser,
  revokeUserSessions,
  userDetails,
} from "@/server/authorization/users";
import {
  inviteUser,
  acceptInvitation,
  resendInvitation,
} from "@/server/auth/invitations";
import {
  customers,
  createCustomer,
  materials,
  changeCost,
  manualRate,
} from "./resources";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function cloudRequest(
  request: Request,
  db = database(),
  source = identity(),
) {
  const requestId = randomUUID();
  try {
    const url = new URL(request.url),
      path = url.pathname.replace(/^\/api\/cloud\//, "");
    const parts = path.split("/");
    let body: unknown;
    if (request.method !== "GET") {
      if (
        request.headers.get("origin") !==
        (process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000")
      )
        throw new AccessError(403, "ORIGIN_REJECTED");
      const text = await request.text();
      if (text.length > 65536) throw new AccessError(413, "BODY_TOO_LARGE");
      body = JSON.parse(text);
    }
    const h = request.headers;
    if (parts[0] === "workspace") {
      const handler =
        ["suppliers", "supplier-materials", "supplier-offers", "supplier-comparison"].includes(parts[1])
          ? supplierRequest
          : parts[1] === "imports"
          ? importRequest
          : ["quotes", "sales"].includes(parts[1])
            ? documentRequest
            : catalogRequest;
      return json(
        await handler(
          h,
          parts.slice(1),
          request.method,
          body,
          url.searchParams,
          db,
          source,
        ),
      );
    }
    if (path === "invitations/accept" && request.method === "POST") {
      const key = `invite-accept:${Math.floor(Date.now() / 60000)}`;
      const bucket = await source.db.authRateLimit.upsert({
        where: { key },
        create: { id: key, key, count: 1, lastRequest: BigInt(Date.now()) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > 20) return json({ error: "TRY_LATER" }, 429);
      return json(await acceptInvitation(body, db, source));
    }
    if (path === "users" && request.method === "GET")
      return json(await listUsers(h, db, source));
    if (path === "users/invite" && request.method === "POST")
      return json(await inviteUser(h, body, db, source));
    if (parts[0] === "users" && parts[1]) {
      z.uuid().parse(parts[1]);
      if (
        parts.length === 3 &&
        parts[2] === "resend-invite" &&
        request.method === "POST"
      )
        return json(await resendInvitation(h, parts[1], db, source));
      if (parts.length === 2 && request.method === "PATCH")
        return json(await changeUser(h, parts[1], body, db, source));
      if (parts.length === 2 && request.method === "GET")
        return json(await userDetails(h, parts[1], db, source));
      if (parts[2] === "sessions" && request.method === "DELETE")
        return json(await revokeUserSessions(h, parts[1], db, source));
    }
    if (path === "context" && request.method === "GET") {
      const c = await contextFor(h, db, source);
      // Companies are selected only from the authenticated grants, never a supplied tenant.
      const entityIds = [
        ...new Set(
          c.grants
            .filter((g) => g.effect === "ALLOW")
            .map((g) => g.scope.legalEntityId)
            .filter((v): v is string => !!v),
        ),
      ];
      const tenantScope = c.grants.some(
        (g) => g.effect === "ALLOW" && g.scope.kind === "TENANT",
      );
      const companies = [];
      // Metadata enumeration has its own active membership/scope SELECT policy.
      const selected = await scoped(
        c,
        (tx) =>
          tx.legalEntity.findMany({
            where: { tenantId: c.tenantId },
            select: { id: true, name: true },
          }),
        db,
      );
      for (const company of selected)
        if (tenantScope || entityIds.includes(company.id))
          companies.push(company);
      const activities = [];
      for (const company of companies)
        activities.push(
          ...(await scoped(
            c,
            (tx) =>
              tx.activity.findMany({
                where: { legalEntityId: company.id, tenantId: c.tenantId },
                select: { id: true, name: true, legalEntityId: true },
              }),
            db,
            company.id,
          )),
        );
      return json({
        membershipId: c.membershipId,
        tenantId: c.tenantId,
        companies,
        activities,
      });
    }
    if (path === "customers" && request.method === "GET")
      return json(
        await customers(h, url.searchParams.get("company") ?? "", db, source),
      );
    if (path === "customers" && request.method === "POST")
      return json(await createCustomer(h, body, db, source), 201);
    if (path === "materials" && request.method === "GET")
      return json(
        await materials(h, url.searchParams.get("company") ?? "", db, source),
      );
    if (
      parts[0] === "materials" &&
      parts[2] === "cost" &&
      request.method === "PATCH"
    )
      return json(await changeCost(h, parts[1], body, db, source));
    if (path === "exchange-rate" && request.method === "POST")
      return json(await manualRate(h, body, db, source), 201);
    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    const status =
      error instanceof AccessError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : 503;
    const code =
      error instanceof AccessError
        ? error.reason
        : status === 400
          ? "INVALID_INPUT"
          : "SERVICE_UNAVAILABLE";
    const databaseCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      /^P\d{4}$/.test(String(error.code))
        ? String(error.code)
        : undefined;
    console.warn("CLOUD_REQUEST_FAILED", {
      requestId,
      status,
      code,
      databaseCode,
    });
    return Response.json(
      { error: code, requestId },
      {
        status,
        headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
      },
    );
  }
}
