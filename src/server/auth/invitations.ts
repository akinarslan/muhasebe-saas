import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { database } from "@/server/db/client";
import { identity, provisionIdentity } from "./core";
import { MailFailure } from "./resend-carrier";
import {
  contextFor,
  scoped,
  authorize,
  requireStepUp,
  AccessError,
  type Context,
} from "@/server/authorization/context";
const schema = z
  .object({
    email: z.email().transform((s) => s.toLowerCase()),
    name: z.string().min(1).max(200),
  })
  .strict();
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
async function inviteContext(
  headers: Headers,
  db: ReturnType<typeof database>,
  source: ReturnType<typeof identity>,
) {
  const c = await contextFor(headers, db, source);
  authorize(c, "users.invite", { tenantId: c.tenantId });
  await requireStepUp(headers, source);
  if (!c.isMaster) throw new AccessError(403, "MASTER_REQUIRED");
  return c;
}
async function sendInvitation(
  context: Context,
  member: { id: string; userId: string },
  email: string,
  db: ReturnType<typeof database>,
  source: ReturnType<typeof identity>,
) {
  const token = randomBytes(32).toString("base64url");
  // Issue, resend and accept lock the identity row before changing validity.
  const invitation = await source.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AuthUser" WHERE id=${member.userId} FOR UPDATE`;
    if (
      (await tx.authUser.findUnique({ where: { id: member.userId } }))
        ?.status !== "INVITED"
    )
      throw new AccessError(409, "INVITATION_NOT_PENDING");
    await tx.authInvitation.updateMany({
      where: { membershipId: member.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const latest = await tx.authInvitation.findFirst({
      where: { membershipId: member.id },
      orderBy: { createdAt: "desc" },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < 30000)
      throw new AccessError(429, "INVITE_RATE_LIMITED");
    return tx.authInvitation.create({
      data: {
        userId: member.userId,
        membershipId: member.id,
        tenantId: context.tenantId,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
  });
  try {
    const result = await source.mail.send({
      to: email,
      kind: "INVITE",
      membershipId: member.id,
      url: `${process.env.AUTH_PUBLIC_URL ?? process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000"}/invite?token=${encodeURIComponent(token)}`,
    });
    await scoped(
      context,
      (tx) =>
        tx.auditEvent.create({
          data: {
            tenantId: context.tenantId,
            actorId: context.userId,
            targetId: member.id,
            action: "INVITATION_MAIL_ACCEPTED",
            summary: {
              provider: result?.provider ?? "local",
              status: result?.status ?? "LOCAL_TEST",
            },
          },
        }),
      db,
    );
    return {
      status: "created",
      delivery:
        result?.provider === "resend"
          ? "resend_accepted"
          : "local_test_carrier",
      membershipId: member.id,
    };
  } catch (error) {
    await source.db.authInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null },
      data: { revokedAt: new Date() },
    });
    if (
      error instanceof MailFailure &&
      ["QUOTA_EXCEEDED", "RATE_LIMITED"].includes(error.code)
    )
      throw new AccessError(429, `MAIL_${error.code}`);
    throw new AccessError(502, "MAIL_SEND_FAILED");
  }
}
export async function inviteUser(
  headers: Headers,
  input: unknown,
  db = database(),
  source = identity(),
) {
  const data = schema.parse(input),
    c = await inviteContext(headers, db, source);
  if (await source.db.authUser.findUnique({ where: { email: data.email } }))
    return { status: "not_created", delivery: "none", membershipId: undefined };
  const created = await provisionIdentity(() =>
    source.auth.api.signUpEmail({
      body: { ...data, password: randomBytes(32).toString("base64url") },
    }),
  );
  await source.db.authUser.update({
    where: { id: created.user.id },
    data: { status: "INVITED" },
  });
  await source.db.authSession.deleteMany({
    where: { userId: created.user.id },
  });
  const member = await scoped(
    c,
    async (tx) => {
      const m = await tx.membership.create({
        data: {
          tenantId: c.tenantId,
          userId: created.user.id,
          status: "INVITED",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: c.tenantId,
          actorId: c.userId,
          targetId: m.id,
          action: "USER_INVITED",
          summary: { status: "INVITED", roleAssigned: false },
        },
      });
      return m;
    },
    db,
  );
  return sendInvitation(c, member, data.email, db, source);
}
export async function resendInvitation(
  headers: Headers,
  membershipId: string,
  db = database(),
  source = identity(),
) {
  z.uuid().parse(membershipId);
  const c = await inviteContext(headers, db, source);
  const member = await scoped(
    c,
    (tx) => tx.membership.findUnique({ where: { id: membershipId } }),
    db,
  );
  if (!member || member.status !== "INVITED")
    throw new AccessError(409, "INVITATION_NOT_PENDING");
  const user = await source.db.authUser.findUnique({
    where: { id: member.userId },
  });
  if (!user || user.status !== "INVITED")
    throw new AccessError(409, "INVITATION_NOT_PENDING");
  return sendInvitation(c, member, user.email, db, source);
}
export async function acceptInvitation(
  input: unknown,
  db = database(),
  source = identity(),
) {
  const data = z
    .object({
      token: z.string().min(40).max(200),
      password: z.string().min(12).max(128),
    })
    .strict()
    .parse(input);
  const hashed = await hashPassword(data.password);
  const invitation = await source.db.$transaction(async (tx) => {
    const found = await tx.authInvitation.findUnique({
      where: { tokenHash: digest(data.token) },
    });
    if (!found) throw new AccessError(400, "INVALID_INVITATION");
    await tx.$queryRaw`SELECT id FROM "AuthUser" WHERE id=${found.userId} FOR UPDATE`;
    if (
      (await tx.authUser.findUnique({ where: { id: found.userId } }))
        ?.status !== "INVITED"
    )
      throw new AccessError(400, "INVALID_INVITATION");
    const invitation = await tx.authInvitation.findUniqueOrThrow({
      where: { id: found.id },
    });
    if (
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() < Date.now()
    )
      throw new AccessError(400, "INVALID_INVITATION");
    const consumed = await tx.authInvitation.updateMany({
      where: {
        id: invitation.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { acceptedAt: new Date() },
    });
    if (consumed.count !== 1) throw new AccessError(400, "INVALID_INVITATION");
    await tx.authInvitation.updateMany({
      where: {
        membershipId: invitation.membershipId,
        id: { not: invitation.id },
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await tx.authAccount.updateMany({
      where: { userId: invitation.userId, providerId: "credential" },
      data: { password: hashed },
    });
    await tx.authUser.update({
      where: { id: invitation.userId },
      data: { status: "ACTIVE", emailVerified: true },
    });
    await tx.authSession.deleteMany({ where: { userId: invitation.userId } });
    return invitation;
  });
  await scoped(
    { userId: invitation.userId, tenantId: invitation.tenantId },
    async (tx) => {
      const updated = await tx.membership.updateMany({
        where: { id: invitation.membershipId, status: "INVITED" },
        data: { status: "ACTIVE", version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new AccessError(409, "INVITATION_NOT_PENDING");
      await tx.auditEvent.create({
        data: {
          tenantId: invitation.tenantId,
          actorId: invitation.userId,
          targetId: invitation.membershipId,
          action: "INVITATION_ACCEPTED",
          summary: { status: "ACTIVE" },
        },
      });
    },
    db,
  );
  return { accepted: true };
}
