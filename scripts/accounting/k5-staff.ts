import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { authRequest, provisionIdentity } from "../../src/server/auth/core";
import type { masterFixture } from "../auth/master-fixture";
export async function k5Staff(
  f: Awaited<ReturnType<typeof masterFixture>>,
  admin: Client,
  tenant: string,
  company: string,
  permissions: string[],
) {
  // Isolate synthetic identity setup from earlier suites' shared loopback-IP quota.
  // No reset occurs during the concurrent financial operations or expired-MFA check.
  await f.source.db.authRateLimit.deleteMany();
  const password = `Synthetic-${randomUUID()}`,
    email = `k5-${randomUUID()}@example.invalid`;
  const user = await provisionIdentity(() =>
    f.source.auth.api.signUpEmail({
      body: { email, password, name: "K5 synthetic staff" },
    }),
  );
  const role = `K5_${randomUUID()}`,
    membership = randomUUID(),
    scope = randomUUID();
  await admin.query(
    "INSERT INTO \"Role\"(id,name) VALUES($1,'K5 acceptance staff')",
    [role],
  );
  for (const permission of permissions)
    await admin.query(
      'INSERT INTO "RolePermission"("roleId","permissionId") VALUES($1,$2)',
      [role, permission],
    );
  await admin.query(
    'INSERT INTO "Membership"(id,"tenantId","userId") VALUES($1,$2,$3)',
    [membership, tenant, user.user.id],
  );
  await admin.query(
    'INSERT INTO "PermissionScope"(id,"tenantId",kind,"legalEntityId") VALUES($1,$2,\'LEGAL_ENTITY\',$3)',
    [scope, tenant, company],
  );
  await admin.query(
    'INSERT INTO "RoleAssignment"(id,"tenantId","membershipId","roleId","scopeId") VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), tenant, membership, role, scope],
  );
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: "http://127.0.0.1:3000",
    "x-pusula-membership": membership,
  });
  const cookies = new Map<string, string>();
  const auth = async (path: string, body: object) => {
    const r = await authRequest(
      new Request(`http://127.0.0.1:3000/api/auth${path}`, {
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
    headers.set("cookie", [...cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    assert.equal(r.status, 200, `AUTH_${path}`);
    return r;
  };
  await auth("/sign-in/email", { email, password });
  await auth("/two-factor/enable", { password });
  const factor = await f.source.db.authTwoFactor.findUniqueOrThrow({
    where: { userId: user.user.id },
  });
  const secret = await symmetricDecrypt({
    key: process.env.AUTH_TEST_SECRET!,
    data: factor.secret,
  });
  await auth("/two-factor/verify-totp", {
    code: await createOTP(secret).totp(),
  });
  const stepUp = async () => {
    await auth("/step-up", { password, code: await createOTP(secret).totp() });
  };
  await stepUp();
  return { headers, userId: user.user.id, stepUp };
}
