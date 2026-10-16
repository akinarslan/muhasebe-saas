import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { database } from "@/server/db/client";
import { identity, provisionIdentity } from "@/server/auth/core";
import {
  contextFor,
  scoped,
  authorize,
  requireStepUp,
  AccessError,
} from "@/server/authorization/context";
const schema = z
  .object({
    email: z.email().transform((s) => s.toLowerCase()),
    name: z.string().min(1).max(200),
  })
  .strict();
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function inviteUser(
  headers: Headers,
  input: unknown,
  db = database(),
  source = identity(),
) {
  const data = schema.parse(input),
    context = await contextFor(headers, db, source);
  authorize(context, "users.invite", { tenantId: context.tenantId });
  await requireStepUp(headers, source);
  if (!context.isMaster) throw new AccessError(403, "MASTER_REQUIRED");
  if (await source.db.authUser.findUnique({ where: { email: data.email } }))
    return { status: "not_created", delivery: "none" };
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
    context,
    async (tx) => {
      const member = await tx.membership.create({
        data: {
          tenantId: context.tenantId,
          userId: created.user.id,
          status: "INVITED",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: context.tenantId,
          actorId: context.userId,
          targetId: member.id,
          action: "USER_INVITED",
          summary: { status: "INVITED", roleAssigned: false },
        },
      });
      return member;
    },
    db,
  );
  const token = randomBytes(32).toString("base64url");
  await source.db.authInvitation.create({
    data: {
      userId: created.user.id,
      membershipId: member.id,
      tenantId: context.tenantId,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  await source.mail.send({
    to: data.email,
    kind: "INVITE",
    url: `${process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000"}/invite?token=${encodeURIComponent(token)}`,
  });
  return {
    status: "created",
    delivery: "local_test_carrier",
    membershipId: member.id,
  };
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
    const invitation = await tx.authInvitation.findUnique({
      where: { tokenHash: digest(data.token) },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt.getTime() < Date.now()
    )
      throw new AccessError(400, "INVALID_INVITATION");
    const consumed = await tx.authInvitation.updateMany({
      where: {
        id: invitation.id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { acceptedAt: new Date() },
    });
    if (consumed.count !== 1) throw new AccessError(400, "INVALID_INVITATION");
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
      await tx.membership.update({
        where: { id: invitation.membershipId },
        data: { status: "ACTIVE", version: { increment: 1 } },
      });
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
