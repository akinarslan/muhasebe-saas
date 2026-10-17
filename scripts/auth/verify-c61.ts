import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { masterFixture } from "./master-fixture";
import {
  createAuth,
  authRequest,
  activeSession,
  provisionIdentity,
} from "../../src/server/auth/core";
import { contextFor, scoped } from "../../src/server/authorization/context";
import { cloudRequest } from "../../src/server/cloud/handler";
import { resendInvitation } from "../../src/server/auth/invitations";
import { listUsers } from "../../src/server/authorization/users";
import { MailFailure } from "../../src/server/auth/resend-carrier";
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  console.log(`PASS ${++passed}: ${name}`);
}
async function run() {
  const f = await masterFixture();
  let mode = "ACCEPTED",
    sends = 0;
  const source = createAuth(
    process.env.TEST_AUTH_DATABASE_URL!,
    process.env.AUTH_TEST_SECRET!,
    true,
    {
      provider: "fixture",
      async send() {
        sends++;
        if (mode !== "ACCEPTED") throw new MailFailure(mode);
        return {
          provider: "resend",
          status: "ACCEPTED",
          messageId: "synthetic-only",
        };
      },
    },
  );
  const request = (path: string, body: unknown, headers = f.headers()) =>
    cloudRequest(
      new Request(`http://127.0.0.1:3000/api/cloud/${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
      f.db,
      source,
    );
  const status = (headers = f.headers()) =>
    authRequest(
      new Request("http://127.0.0.1:3000/api/auth/step-up/status", { headers }),
      source,
    );
  const unique = () => `c61-${randomBytes(9).toString("hex")}@example.invalid`;
  const session = (await activeSession(f.headers(), source))!;
  const stamp = () =>
    source.db.authSession.update({
      where: { id: session.session.id },
      data: { stepUpAt: new Date() },
    });
  try {
    await check(
      "existing member returns 409 with safe requestId; no invitation or mail",
      async () => {
        const before = await source.db.authInvitation.count();
        const response = await request("users/invite", {
          email: f.credentials.email,
          name: "Existing fixture",
        });
        const body = await response.json();
        assert.equal(response.status, 409);
        assert.equal(body.error, "ALREADY_MEMBER");
        assert.match(body.requestId, /^[a-f0-9-]{36}$/);
        assert.equal(response.headers.get("X-Request-Id"), body.requestId);
        assert.equal(await source.db.authInvitation.count(), before);
        assert.equal(sends, 0);
      },
    );
    await check("unauthenticated caller learns no identity state", async () => {
      const h = new Headers({
        Origin: "http://127.0.0.1:3000",
        "Content-Type": "application/json",
      });
      const response = await request(
        "users/invite",
        { email: f.credentials.email, name: "Synthetic" },
        h,
      );
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error, "UNAUTHENTICATED");
    });
    await check(
      "step-up status is session-bound and expires at five minutes",
      async () => {
        assert.equal((await (await status()).json()).verified, true);
        assert.equal((await status(new Headers())).status, 401);
        for (const stepUpAt of [null, new Date(Date.now() - 300001)]) {
          await source.db.authSession.update({
            where: { id: session.session.id },
            data: { stepUpAt },
          });
          assert.equal((await (await status()).json()).verified, false);
          const response = await request("users/invite", {
            email: unique(),
            name: "Expired fixture",
          });
          assert.equal(response.status, 403);
          assert.equal((await response.json()).error, "STEP_UP_REQUIRED");
        }
        await stamp();
      },
    );
    let memberId = "";
    const email = unique();
    await check(
      "concurrent invitation creation stores one identity membership and sends once",
      async () => {
        const before = sends;
        const results = await Promise.all([
          request("users/invite", { email, name: "Concurrent fixture" }),
          request("users/invite", { email, name: "Concurrent fixture" }),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        const created = await results.find((r) => r.status === 200)!.json();
        assert.equal(created.status, "created");
        memberId = created.membershipId;
        const user = await source.db.authUser.findUniqueOrThrow({
          where: { email },
        });
        assert.equal(
          await source.db.authInvitation.count({ where: { userId: user.id } }),
          1,
        );
        assert.equal(sends - before, 1);
      },
    );
    await check(
      "pending duplicate has explicit conflict; list shows pending lifecycle and acceptance",
      async () => {
        const response = await request("users/invite", {
          email,
          name: "Duplicate fixture",
        });
        assert.equal(response.status, 409);
        assert.equal((await response.json()).error, "ALREADY_PENDING");
        const listed = await listUsers(f.headers(), f.db, source);
        const row = listed.members.find((m) => m.id === memberId)!;
        assert.equal(row.status, "INVITED");
        assert.equal(row.invitationStatus, "PENDING");
        assert.equal(row.mailStatus?.status, "ACCEPTED");
      },
    );
    let outsideEmail = "";
    await check(
      "another identity never inherits step-up or reveals existing member state",
      async () => {
        outsideEmail = unique();
        const signup = await provisionIdentity(() =>
          source.auth.api.signUpEmail({
            body: {
              email: outsideEmail,
              name: "Separate identity fixture",
              password: randomBytes(24).toString("base64url"),
            },
            asResponse: true,
          }),
        );
        const headers = new Headers({
          Origin: "http://127.0.0.1:3000",
          "Content-Type": "application/json",
          cookie: signup.headers
            .getSetCookie()
            .map((v) => v.split(";")[0])
            .join("; "),
        });
        assert.equal((await (await status(headers)).json()).verified, false);
        const denied = await request(
          "users/invite",
          { email: f.credentials.email, name: "No grant fixture" },
          headers,
        );
        assert.equal(denied.status, 403);
        assert.equal((await denied.json()).error, "MEMBERSHIP_REQUIRED");
      },
    );
    await check(
      "explicit DENY blocks a master invitation without weakening policy",
      async () => {
        const c = await contextFor(f.headers(), f.db, source);
        const records = await scoped(
          c,
          async (tx) => {
            const scope = await tx.permissionScope.create({
              data: { tenantId: c.tenantId, kind: "TENANT" },
            });
            const override = await tx.userPermissionOverride.create({
              data: {
                tenantId: c.tenantId,
                membershipId: c.membershipId,
                permissionId: "users.invite",
                effect: "DENY",
                scopeId: scope.id,
              },
            });
            return { scope, override };
          },
          f.db,
        );
        try {
          const response = await request("users/invite", {
            email: unique(),
            name: "Denied fixture",
          });
          assert.equal(response.status, 403);
          assert.equal((await response.json()).error, "FORBIDDEN");
        } finally {
          await scoped(
            c,
            async (tx) => {
              await tx.userPermissionOverride.delete({
                where: { id: records.override.id },
              });
              await tx.permissionScope.delete({
                where: { id: records.scope.id },
              });
            },
            f.db,
          );
        }
      },
    );
    await check(
      "existing identity outside authorized membership is not attached or disclosed",
      async () => {
        const before = sends;
        const response = await request("users/invite", {
          email: outsideEmail,
          name: "Unmatched identity",
        });
        assert.equal(response.status, 409);
        assert.equal((await response.json()).error, "INVITATION_UNAVAILABLE");
        assert.equal(sends, before);
        assert(
          !(await listUsers(f.headers(), f.db, source)).members.some(
            (m) => m.user?.email === outsideEmail,
          ),
        );
      },
    );
    for (const [failure, http, statusCode] of [
      ["SENDER_OR_RECIPIENT_REJECTED", 502, "FAILED"],
      ["RATE_LIMITED", 429, "FAILED"],
      ["NETWORK_OR_TIMEOUT", 502, "UNKNOWN"],
      ["PROVIDER_REJECTED", 502, "FAILED"],
    ] as const) {
      await check(
        `provider ${failure} preserves visible pending member and safe failure state`,
        async () => {
          mode = failure;
          const target = unique();
          const response = await request("users/invite", {
            email: target,
            name: "Failure fixture",
          });
          assert.equal(response.status, http);
          const body = await response.json();
          assert(body.requestId);
          assert.equal(
            body.error,
            failure === "RATE_LIMITED"
              ? "MAIL_RATE_LIMITED"
              : failure === "NETWORK_OR_TIMEOUT"
                ? "MAIL_DELIVERY_UNKNOWN"
                : "MAIL_SEND_FAILED",
          );
          const row = (await listUsers(f.headers(), f.db, source)).members.find(
            (m) => m.user?.email === target,
          )!;
          assert(row);
          assert.equal(row.status, "INVITED");
          assert.equal(row.mailStatus?.status, statusCode);
          assert.equal(row.invitationStatus, "CANCELLED");
          await source.db.authInvitation.updateMany({
            where: { membershipId: row.id },
            data: { createdAt: new Date(Date.now() - 60000) },
          });
          mode = "ACCEPTED";
          await resendInvitation(f.headers(), row.id, f.db, source);
        },
      );
    }
    await check(
      "logout destroys step-up proof in the same cookie session",
      async () => {
        const response = await authRequest(
          new Request("http://127.0.0.1:3000/api/auth/sign-out", {
            method: "POST",
            headers: f.headers(),
            body: "{}",
          }),
          source,
        );
        assert.equal(response.status, 200);
        assert.equal((await status()).status, 401);
      },
    );
  } finally {
    await source.db.$disconnect();
    await f.close();
  }
}
run().catch((e) => {
  console.error(
    `C61 failed after ${passed} checks`,
    e?.name,
    e?.code,
    e?.reason,
  );
  process.exitCode = 1;
});
