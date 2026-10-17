import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { masterFixture } from "./master-fixture";
import { createAuth, authRequest } from "../../src/server/auth/core";
import {
  inviteUser,
  resendInvitation,
  acceptInvitation,
} from "../../src/server/auth/invitations";
import { listUsers } from "../../src/server/authorization/users";
import { MailFailure } from "../../src/server/auth/resend-carrier";
import type { AuthMail } from "../../src/server/auth/mail";
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  console.log(`PASS ${++passed}: ${name}`);
}
async function run() {
  const f = await masterFixture(),
    messages: AuthMail[] = [];
  let fail = true;
  const source = createAuth(
    process.env.TEST_AUTH_DATABASE_URL!,
    process.env.AUTH_TEST_SECRET!,
    true,
    {
      provider: "fixture",
      async send(message) {
        messages.push(message);
        if (fail) throw new MailFailure("QUOTA_EXCEEDED");
        return {
          provider: "resend",
          status: "ACCEPTED",
          messageId: "fixture-only",
        };
      },
    },
  );
  const email = `c6-${randomBytes(10).toString("hex")}@example.invalid`;
  const token = (m: AuthMail) =>
    m.kind === "INVITE"
      ? new URL(m.url).searchParams.get("token")!
      : new URL(m.url).pathname.split("/").at(-1)!;
  const password = randomBytes(24).toString("base64url");
  let memberId = "";
  const age = () =>
    source.db.authInvitation.updateMany({
      where: { membershipId: memberId },
      data: { createdAt: new Date(Date.now() - 60000) },
    });
  try {
    await check(
      "failed invitation reports quota error and persists FAILED without valid token",
      async () => {
        await assert.rejects(
          inviteUser(
            f.headers(),
            { email, name: "C6 synthetic" },
            f.db,
            source,
          ),
          { reason: "MAIL_QUOTA_EXCEEDED" },
        );
        const invitation = await source.db.authInvitation.findFirstOrThrow({
          where: {
            userId: (
              await source.db.authUser.findUniqueOrThrow({ where: { email } })
            ).id,
          },
        });
        memberId = invitation.membershipId;
        assert(invitation.revokedAt);
        await assert.rejects(
          acceptInvitation(
            { token: token(messages[0]), password },
            f.db,
            source,
          ),
        );
        const status = await source.db.authMailDelivery.findFirstOrThrow({
          where: { membershipId: memberId },
          orderBy: { createdAt: "desc" },
        });
        assert.equal(status.status, "FAILED");
        assert.equal(status.errorCode, "QUOTA_EXCEEDED");
      },
    );
    await check(
      "retry accepted; previous token revoked and resend throttled",
      async () => {
        fail = false;
        await age();
        assert.equal(
          (await resendInvitation(f.headers(), memberId, f.db, source))
            .delivery,
          "resend_accepted",
        );
        await assert.rejects(
          resendInvitation(f.headers(), memberId, f.db, source),
          { reason: "INVITE_RATE_LIMITED" },
        );
        const previous = token(messages.at(-1)!);
        await age();
        await resendInvitation(f.headers(), memberId, f.db, source);
        await assert.rejects(
          acceptInvitation({ token: previous, password }, f.db, source),
        );
      },
    );
    await check(
      "latest invitation accepts once and cannot be resent after activation",
      async () => {
        const input = { token: token(messages.at(-1)!), password };
        await acceptInvitation(input, f.db, source);
        await assert.rejects(acceptInvitation(input, f.db, source));
        await assert.rejects(
          resendInvitation(f.headers(), memberId, f.db, source),
        );
      },
    );
    await check(
      "user DTO exposes safe status without tokens or provider IDs",
      async () => {
        const data = await listUsers(f.headers(), f.db, source);
        const member = data.members.find((m) => m.id === memberId)!;
        assert.equal(member.mailStatus?.status, "ACCEPTED");
        assert(!JSON.stringify(member.mailStatus).includes("fixture-only"));
        assert(!JSON.stringify(member.mailStatus).includes("token"));
      },
    );
    const call = (email: string) =>
      authRequest(
        new Request("http://127.0.0.1:3000/api/auth/request-password-reset", {
          method: "POST",
          headers: {
            Origin: "http://127.0.0.1:3000",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, redirectTo: "/reset-password" }),
        }),
        source,
      );
    await check(
      "failed reset keeps public response generic and invalidates undelivered token",
      async () => {
        fail = true;
        const known = await call(email),
          unknown = await call("missing-c6@example.invalid");
        assert.equal(known.status, unknown.status);
        assert.deepEqual(await known.json(), { status: "request_received" });
        assert.deepEqual(await unknown.json(), { status: "request_received" });
        assert.equal(
          await source.db.authVerification.count({
            where: { identifier: `reset-password:${token(messages.at(-1)!)}` },
          }),
          0,
        );
      },
    );
    await check(
      "reset retry creates a single-use replacement and resets password",
      async () => {
        fail = false;
        await source.db.authRateLimit.deleteMany();
        await call(email);
        const first = token(messages.at(-1)!);
        await source.db.authRateLimit.deleteMany();
        await call(email);
        const latest = token(messages.at(-1)!);
        assert.equal(
          await source.db.authVerification.count({
            where: { identifier: `reset-password:${first}` },
          }),
          0,
        );
        const body = {
          token: latest,
          newPassword: randomBytes(24).toString("base64url"),
        };
        await source.auth.api.resetPassword({ body });
        await assert.rejects(source.auth.api.resetPassword({ body }));
      },
    );
  } finally {
    await source.db.$disconnect();
    await f.close();
  }
}
run().catch((e) => {
  console.error(`C6 failed after ${passed} checks`, e?.name, e?.code);
  process.exitCode = 1;
});
