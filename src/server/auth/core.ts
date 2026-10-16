import "server-only";
import { betterAuth, APIError } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { AsyncLocalStorage } from "node:async_hooks";
import { twoFactor } from "better-auth/plugins";
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
    plugins: [twoFactor({ issuer: "Pusula", schema: { twoFactor: { modelName: "AuthTwoFactor" } },
      backupCodeOptions: { storeBackupCodes: "encrypted" }, twoFactorCookieMaxAge: 300 })],
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
const publicPaths = new Set(["/sign-in/email", "/sign-out", "/get-session",
  "/two-factor/enable", "/two-factor/verify-totp", "/two-factor/verify-backup-code", "/step-up"]);
export async function authRequest(request: Request, source = identity()) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  if (!publicPaths.has(path)) return Response.json({ error: "Unavailable" }, { status: 404 });
  if (request.method === "POST") {
    if (request.headers.get("origin") !== (process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000"))
      return Response.json({ error: "Origin rejected" }, { status: 403 });
    const body = await request.clone().json().catch(() => null);
    if (!body || body.trustDevice === true || body.disableSession === true || (body.method && body.method !== "totp"))
      return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (path === "/step-up") {
    const session = await activeSession(request.headers, source);
    if (!session || !session.user.twoFactorEnabled) return Response.json({ error: "MFA required" }, { status: 403 });
    const key = `step-up:${session.user.id}:${Math.floor(Date.now()/300000)}`;
    const bucket = await source.db.authRateLimit.upsert({ where: { key },
      create: { id: key, key, count: 1, lastRequest: BigInt(Date.now()) }, update: { count: { increment: 1 } } });
    if (bucket.count > 5) return Response.json({error:"Try later"},{status:429});
    const body = await request.json();
    try {
      await source.auth.api.verifyPassword({ headers: request.headers, body: { password: body.password } });
      await source.auth.api.verifyTOTP({ headers: request.headers, body: { code: body.code } });
      await source.db.authSession.update({ where: { id: session.session.id }, data: { stepUpAt: new Date(), mfaVerifiedAt: new Date() } });
      return Response.json({ verified: true });
    } catch { return Response.json({ error: "Verification failed" }, { status: 403 }); }
  }
  const response = await source.auth.handler(request);
  if (response.ok && ["/two-factor/verify-totp", "/two-factor/verify-backup-code"].includes(path)) {
    const cookies = new Map((request.headers.get("cookie") ?? "").split(";").map(c => { const i=c.indexOf("="); return [c.slice(0,i).trim(),c.slice(i+1)]; }));
    for (const value of response.headers.getSetCookie()) { const part=value.split(";")[0]; const i=part.indexOf("="); cookies.set(part.slice(0,i),part.slice(i+1)); }
    const headers = new Headers(request.headers);
    headers.set("cookie", [...cookies].map(([k,v])=>`${k}=${v}`).join("; "));
    const session = await activeSession(headers, source);
    if (session) {
      await source.db.authSession.update({where:{id:session.session.id},data:{mfaVerifiedAt:new Date()}});
      await source.db.authSecurityEvent.create({data:{userId:session.user.id,action:path.endsWith("verify-totp")?"MFA_TOTP_VERIFIED":"MFA_RECOVERY_USED"}});
    }
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
