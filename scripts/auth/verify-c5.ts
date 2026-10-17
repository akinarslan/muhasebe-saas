import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { masterFixture } from "./master-fixture";
import {
  authRequest,
  provisionIdentity,
  activeSession,
} from "../../src/server/auth/core";
import { contextFor, scoped } from "../../src/server/authorization/context";
import { protectLastMaster } from "../../src/server/authorization/users";
import { cloudRequest } from "../../src/server/cloud/handler";
import { createDatabase } from "../../src/server/db/client";
import { assertDevelopmentTarget } from "../../src/server/db/target";
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  console.log(`PASS ${++passed}: ${name}`);
}
async function run() {
  const f = await masterFixture();
  assertDevelopmentTarget(process.env.TEST_DIRECT_DATABASE_URL, true, true);
  const admin = new Client({
    connectionString: process.env.TEST_DIRECT_DATABASE_URL,
  });
  await admin.connect();
  try {
    const email = `reset-${randomBytes(8).toString("hex")}@example.invalid`,
      oldPassword = randomBytes(24).toString("base64url"),
      newPassword = randomBytes(24).toString("base64url");
    const created = await provisionIdentity(() =>
      f.source.auth.api.signUpEmail({
        body: { email, password: oldPassword, name: "C5 reset fixture" },
      }),
    );
    const origin = "http://127.0.0.1:3000",
      headers = { Origin: origin, "Content-Type": "application/json" };
    const call = (path: string, body: object) =>
      authRequest(
        new Request(`${origin}/api/auth${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
        f.source,
      );
    let resetToken = "";
    await check(
      "reset response does not reveal account existence; delivery is test-only",
      async () => {
        const known = await call("/request-password-reset", {
          email,
          redirectTo: "/reset-password",
        });
        const unknown = await call("/request-password-reset", {
          email: "missing@example.invalid",
          redirectTo: "/reset-password",
        });
        assert.equal(known.status, 200);
        assert.equal(unknown.status, 200);
        assert.deepEqual(await known.json(), await unknown.json());
        const message = f.messages.find(
          (m) => m.to === email && m.kind === "RESET",
        )!;
        assert(message);
        const link = new URL(message.url);
        resetToken = link.pathname.split("/").at(-1)!;
        const redirect = await authRequest(new Request(message.url), f.source);
        assert.equal(redirect.status, 302);
        assert(redirect.headers.get("location")?.includes("/reset-password?"));
      },
    );
    await check(
      "password reset single use, old password and sessions invalidated",
      async () => {
        const r = await call("/sign-in/email", {
          email,
          password: oldPassword,
        });
        const cookie = r.headers
          .getSetCookie()
          .map((x) => x.split(";")[0])
          .join("; ");
        assert.equal(r.status, 200);
        assert.equal(
          (await call("/reset-password", { token: resetToken, newPassword }))
            .status,
          200,
        );
        assert.equal(
          await activeSession(new Headers({ cookie }), f.source),
          null,
        );
        assert.notEqual(
          (
            await call("/reset-password", {
              token: resetToken,
              newPassword: oldPassword,
            })
          ).status,
          200,
        );
        assert.equal(
          (await call("/sign-in/email", { email, password: oldPassword }))
            .status,
          401,
        );
        assert.equal(
          (await call("/sign-in/email", { email, password: newPassword }))
            .status,
          200,
        );
      },
    );
    await check("expired reset token rejected", async () => {
      await f.source.db.authRateLimit.deleteMany();
      await call("/request-password-reset", {
        email,
        redirectTo: "/reset-password",
      });
      const m = f.messages.filter((m) => m.to === email).at(-1)!;
      const token = new URL(m.url).pathname.split("/").at(-1)!;
      await f.source.db.authVerification.updateMany({
        where: { identifier: { contains: token } },
        data: { expiresAt: new Date(0) },
      });
      assert.notEqual(
        (await call("/reset-password", { token, newPassword: oldPassword }))
          .status,
        200,
      );
    });
    await check(
      "account throttle works independently of forwarded IP",
      async () => {
        await f.source.db.authRateLimit.deleteMany();
        let limited = false;
        for (let i = 0; i < 12; i++) {
          const r = await authRequest(
            new Request(`${origin}/api/auth/sign-in/email`, {
              method: "POST",
              headers: { ...headers, "x-forwarded-for": `192.0.2.${i + 1}` },
              body: JSON.stringify({ email, password: "wrong-password" }),
            }),
            f.source,
          );
          if (r.status === 429) limited = true;
        }
        assert(limited);
      },
    );
    await check(
      "last-master guard serializes two concurrent demotions",
      async () => {
        const tenant = randomUUID(),
          m1 = randomUUID(),
          m2 = randomUUID();
        await admin.query('INSERT INTO "Tenant"(id,name) VALUES($1,$2)', [
          tenant,
          "C5 concurrency fixture",
        ]);
        await admin.query(
          'INSERT INTO "Membership"(id,"tenantId","userId","isMaster") VALUES($1,$2,$3,true),($4,$2,$5,true)',
          [
            m1,
            tenant,
            created.user.id,
            m2,
            (await f.source.db.authBootstrap.findFirstOrThrow()).userId,
          ],
        );
        const demote = (id: string) =>
          scoped(
            { tenantId: tenant, userId: created.user.id },
            async (tx) => {
              await protectLastMaster(tx, tenant, id, false, "INACTIVE");
              await tx.membership.update({
                where: { id },
                data: { isMaster: false, status: "INACTIVE" },
              });
            },
            f.db,
          );
        const results = await Promise.allSettled([demote(m1), demote(m2)]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const n = await admin.query(
          'SELECT count(*)::int n FROM "Membership" WHERE "tenantId"=$1 AND "isMaster" AND status=$2',
          [tenant, "ACTIVE"],
        );
        assert.equal(n.rows[0].n, 1);
      },
    );
    await check(
      "DB outage fails closed with no demo data fallback",
      async () => {
        const bad = new URL(process.env.TEST_DATABASE_URL!);
        bad.password = randomBytes(32).toString("hex");
        const db = createDatabase(bad.toString(), true);
        try {
          const response = await cloudRequest(
            new Request(`${origin}/api/cloud/users`, { headers: f.headers() }),
            db,
            f.source,
          );
          assert.equal(response.status, 503);
          const body = await response.json();
          assert.deepEqual(Object.keys(body).sort(), ["error", "requestId"]);
          assert.equal(body.error, "SERVICE_UNAVAILABLE");
          assert.match(body.requestId, /^[a-f0-9-]{36}$/);
        } finally {
          await db.$disconnect();
        }
      },
    );
    await check(
      "public session JSON never includes bearer session token",
      async () => {
        const response = await authRequest(
          new Request(`${origin}/api/auth/get-session`, {
            headers: f.headers(),
          }),
          f.source,
        );
        const text = await response.text();
        assert(!text.includes('"token"'));
        assert(!text.includes('"password"'));
        assert(!text.includes('"secret"'));
      },
    );
    await check("step-up expiry blocks critical operations", async () => {
      const c = await contextFor(f.headers(), f.db, f.source);
      await f.source.db.authSession.update({
        where: { id: c.sessionId },
        data: { stepUpAt: new Date(0) },
      });
      const r = await cloudRequest(
        new Request(`${origin}/api/cloud/users/invite`, {
          method: "POST",
          headers: f.headers(),
          body: JSON.stringify({
            email: "never-invited@example.invalid",
            name: "No write",
          }),
        }),
        f.db,
        f.source,
      );
      assert.equal(r.status, 403);
      assert.equal((await r.json()).error, "STEP_UP_REQUIRED");
    });
  } finally {
    await admin.end();
    await f.close();
  }
}
run().catch((e) => {
  console.error(
    `C5 security failed after ${passed} checks`,
    e?.name,
    e?.code,
    e?.reason,
  );
  process.exitCode = 1;
});
