import "server-only";
import { betterAuth, APIError } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { AsyncLocalStorage } from "node:async_hooks";
import { createDatabase } from "@/server/db/client";

const provisioning = new AsyncLocalStorage<boolean>();
export function provisionIdentity<T>(operation: () => Promise<T>) {
  return provisioning.run(true, operation);
}
export function createAuth(connection: string, secret: string, test = false) {
  if (secret.length < 32) throw new Error("Auth configuration is unavailable.");
  const db = createDatabase(connection, test);
  const origin = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
  const auth = betterAuth({
    appName: "Pusula",
    baseURL: origin,
    secret,
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    user: { modelName: "AuthUser", additionalFields: {
      status: { type: "string", defaultValue: "ACTIVE", input: false, returned: false },
    } },
    session: { modelName: "AuthSession", expiresIn: 60 * 60 * 8,
      updateAge: 60 * 15, cookieCache: { enabled: false } },
    account: { modelName: "AuthAccount" },
    verification: { modelName: "AuthVerification" },
    emailAndPassword: { enabled: true, minPasswordLength: 12,
      maxPasswordLength: 128, revokeSessionsOnPasswordReset: true },
    rateLimit: { enabled: true, storage: "database", modelName: "AuthRateLimit",
      window: 60, max: 30, customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      } },
    advanced: { useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" } },
    logger: { disabled: true },
    databaseHooks: {
      user: { create: { before: async () => {
        if (!provisioning.getStore()) throw new APIError("FORBIDDEN", { message: "Provisioning required" });
      } } },
      session: { create: { before: async (session) => {
        // Signup creates user and session in one adapter transaction. The user
        // is not visible to another connection until provisioning commits.
        if (provisioning.getStore()) return;
        const user = await db.authUser.findUnique({ where: { id: session.userId }, select: { status: true } });
        if (user?.status !== "ACTIVE") throw new APIError("UNAUTHORIZED", { message: "Sign in unavailable" });
      } } },
    },
  });
  return { auth, db };
}
let instance: ReturnType<typeof createAuth> | undefined;
export function identity() {
  return instance ??= createAuth(process.env.AUTH_DATABASE_URL ?? "", process.env.AUTH_SECRET ?? "");
}
export async function activeSession(headers: Headers, source = identity()) {
  const result = await source.auth.api.getSession({ headers, query: { disableCookieCache: true } });
  if (!result) return null;
  const user = await source.db.authUser.findUnique({ where: { id: result.user.id }, select: { status: true } });
  return user?.status === "ACTIVE" ? result : null;
}
const publicPaths = new Set(["/sign-in/email", "/sign-out", "/get-session"]);
export async function authRequest(request: Request, source = identity()) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  if (!publicPaths.has(path)) return Response.json({ error: "Unavailable" }, { status: 404 });
  return source.auth.handler(request);
}
