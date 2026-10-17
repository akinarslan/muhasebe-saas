import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { database } from "@/server/db/client";
import { identity } from "@/server/auth/core";
import {
  contextFor,
  scoped,
  authorize,
  requireStepUp,
  AccessError,
  type Context,
} from "./context";
import { permissions, roleTemplates } from "@/lib/auth/catalog";
import { decide } from "@/lib/auth/policy";
export const userChangeSchema = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "INVITED"]),
    roleId: z.enum([
      "MASTER",
      "ACCOUNTANT",
      "SALES",
      "PRODUCTION",
      "PURCHASING",
      "REPORTER",
    ]),
    scope: z
      .object({
        kind: z.enum(["OWN", "ACTIVITY", "LEGAL_ENTITY", "TENANT"]),
        legalEntityId: z.uuid().nullable(),
        activityId: z.uuid().nullable(),
      })
      .strict(),
    overrides: z
      .array(
        z
          .object({
            permissionId: z.enum(
              permissions.map((p) => p.id) as [string, ...string[]],
            ),
            effect: z.enum(["ALLOW", "DENY"]),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export async function protectLastMaster(
  tx: Prisma.TransactionClient,
  tenantId: string,
  targetId: string,
  nextMaster: boolean,
  nextStatus: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId},7303))::text`;
  const target = await tx.membership.findUnique({ where: { id: targetId } });
  if (!target || target.tenantId !== tenantId)
    throw new AccessError(404, "NOT_FOUND");
  if (
    target.isMaster &&
    target.status === "ACTIVE" &&
    (!nextMaster || nextStatus !== "ACTIVE")
  ) {
    if (
      (await tx.membership.count({
        where: { tenantId, isMaster: true, status: "ACTIVE" },
      })) <= 1
    )
      throw new AccessError(409, "LAST_MASTER");
  }
  return target;
}
export async function changeUser(
  headers: Headers,
  targetId: string,
  input: unknown,
  db = database(),
  source = identity(),
) {
  const data = userChangeSchema.parse(input),
    context = await contextFor(headers, db, source);
  authorize(context, "users.roles", { tenantId: context.tenantId });
  authorize(context, "users.permissions", { tenantId: context.tenantId });
  await requireStepUp(headers, source);
  if (!context.isMaster) throw new AccessError(403, "MASTER_REQUIRED");
  if (targetId === context.membershipId)
    throw new AccessError(403, "SELF_CHANGE_FORBIDDEN");
  if (
    data.scope.kind === "TENANT" &&
    (data.scope.legalEntityId || data.scope.activityId)
  )
    throw new AccessError(400, "INVALID_SCOPE");
  if (data.scope.kind !== "TENANT" && !data.scope.legalEntityId)
    throw new AccessError(400, "INVALID_SCOPE");
  if ((data.scope.kind === "ACTIVITY") !== !!data.scope.activityId)
    throw new AccessError(400, "INVALID_SCOPE");
  if (data.roleId === "MASTER" && data.scope.kind !== "TENANT")
    throw new AccessError(400, "MASTER_TENANT_SCOPE_REQUIRED");
  const target = await scoped(
    context,
    async (tx) => {
      const before = await protectLastMaster(
        tx,
        context.tenantId,
        targetId,
        data.roleId === "MASTER",
        data.status,
      );
      if (before.version !== data.version)
        throw new AccessError(409, "VERSION_CONFLICT");
      if (
        data.scope.legalEntityId &&
        !(await tx.legalEntity.findFirst({
          where: { id: data.scope.legalEntityId, tenantId: context.tenantId },
        }))
      )
        throw new AccessError(403, "SCOPE_REJECTED");
      if (
        data.scope.activityId &&
        !(await tx.activity.findFirst({
          where: {
            id: data.scope.activityId,
            tenantId: context.tenantId,
            legalEntityId: data.scope.legalEntityId!,
          },
        }))
      )
        throw new AccessError(403, "SCOPE_REJECTED");
      const granted = [
        ...roleTemplates.find((r) => r.id === data.roleId)!.permissions,
        ...data.overrides
          .filter((o) => o.effect === "ALLOW")
          .map((o) => o.permissionId),
      ];
      for (const action of granted) {
        const resource = {
          tenantId: context.tenantId,
          legalEntityId: data.scope.legalEntityId,
          activityId: data.scope.activityId,
          createdById: before.userId,
        };
        if (!decide(context.userId, action, resource, context.grants))
          throw new AccessError(403, "GRANT_EXCEEDS_ACTOR_SCOPE");
        // Broad delegation must not wash out the actor's narrower explicit denies.
        if (
          context.grants.some(
            (g) =>
              g.permissionId === action &&
              g.effect === "DENY" &&
              (!data.scope.legalEntityId ||
                !g.scope.legalEntityId ||
                g.scope.legalEntityId === data.scope.legalEntityId) &&
              (!data.scope.activityId ||
                !g.scope.activityId ||
                g.scope.activityId === data.scope.activityId),
          )
        )
          throw new AccessError(403, "GRANT_EXCEEDS_ACTOR_SCOPE");
      }
      if (before.status !== data.status)
        authorize(context, "users.deactivate", { tenantId: context.tenantId });
      await tx.roleAssignment.deleteMany({ where: { membershipId: targetId } });
      await tx.userPermissionOverride.deleteMany({
        where: { membershipId: targetId },
      });
      const scope = await tx.permissionScope.create({
        data: { tenantId: context.tenantId, ...data.scope },
      });
      await tx.roleAssignment.create({
        data: {
          tenantId: context.tenantId,
          membershipId: targetId,
          roleId: data.roleId,
          scopeId: scope.id,
        },
      });
      for (const override of data.overrides)
        await tx.userPermissionOverride.create({
          data: {
            tenantId: context.tenantId,
            membershipId: targetId,
            scopeId: scope.id,
            ...override,
          },
        });
      const after = await tx.membership.update({
        where: { id: targetId },
        data: {
          status: data.status,
          isMaster: data.roleId === "MASTER",
          version: { increment: 1 },
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: context.tenantId,
          actorId: context.userId,
          targetId,
          action: "USER_ACCESS_CHANGED",
          summary: {
            before: {
              status: before.status,
              master: before.isMaster,
              version: before.version,
            },
            after: {
              status: after.status,
              roleId: data.roleId,
              scope: data.scope,
              overrides: data.overrides,
              version: after.version,
            },
          },
        },
      });
      return after;
    },
    db,
    data.scope.legalEntityId ?? undefined,
  );
  // Membership is the authoritative tenant gate and is already committed before
  // global identity/session cleanup; a cleanup outage cannot restore access.
  const activeMemberships = await scoped(
    { userId: target.userId, tenantId: context.tenantId },
    (tx) =>
      tx.membership.count({
        where: { userId: target.userId, status: "ACTIVE" },
      }),
    db,
  );
  await source.db.authUser.update({
    where: { id: target.userId },
    data: { status: activeMemberships > 0 ? "ACTIVE" : data.status },
  });
  if (data.status !== "ACTIVE")
    await source.db.authSession.deleteMany({
      where: { userId: target.userId },
    });
  return { version: target.version };
}
export async function listUsers(
  headers: Headers,
  db = database(),
  source = identity(),
) {
  const context = await contextFor(headers, db, source);
  authorize(context, "users.view", { tenantId: context.tenantId });
  const members = await scoped(
    context,
    (tx) =>
      tx.membership.findMany({
        where: { tenantId: context.tenantId },
        include: {
          roles: { include: { role: true, scope: true } },
          overrides: { include: { scope: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
    db,
  );
  const users = await source.db.authUser.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: {
      id: true,
      name: true,
      email: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
    },
  });
  const deliveries = await source.db.authMailDelivery.findMany({
    where: {
      userId: { in: members.map((m) => m.userId) },
      OR: [
        { membershipId: { in: members.map((m) => m.id) } },
        { kind: "RESET", membershipId: null },
      ],
    },
    select: {
      userId: true,
      membershipId: true,
      kind: true,
      provider: true,
      status: true,
      errorCode: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return {
    membershipId: context.membershipId,
    canManage:
      context.isMaster &&
      decide(
        context.userId,
        "users.roles",
        { tenantId: context.tenantId },
        context.grants,
      ) &&
      decide(
        context.userId,
        "users.permissions",
        { tenantId: context.tenantId },
        context.grants,
      ),
    members: members.map((m) => ({
      ...m,
      user: users.find((u) => u.id === m.userId),
      mailStatus:
        deliveries.find(
          (d) =>
            d.userId === m.userId &&
            (!d.membershipId || d.membershipId === m.id),
        ) ?? null,
    })),
    permissions,
    roles: roleTemplates,
  };
}
export async function revokeUserSessions(
  headers: Headers,
  targetId: string,
  db = database(),
  source = identity(),
) {
  const context = await contextFor(headers, db, source);
  authorize(context, "users.sessions", { tenantId: context.tenantId });
  await requireStepUp(headers, source);
  const target = await scoped(
    context,
    async (tx) => {
      const member = await tx.membership.findUnique({
        where: { id: targetId },
      });
      if (!member) throw new AccessError(404, "NOT_FOUND");
      await tx.auditEvent.create({
        data: {
          tenantId: context.tenantId,
          actorId: context.userId,
          targetId,
          action: "SESSIONS_REVOKED",
          summary: { all: true },
        },
      });
      return member;
    },
    db,
  );
  await source.db.authSession.deleteMany({ where: { userId: target.userId } });
  return { revoked: true };
}
export async function userDetails(
  headers: Headers,
  targetId: string,
  db = database(),
  source = identity(),
) {
  const context = await contextFor(headers, db, source);
  authorize(context, "users.audit", { tenantId: context.tenantId });
  const data = await scoped(
    context,
    async (tx) => {
      const member = await tx.membership.findUnique({
        where: { id: targetId },
      });
      if (!member) throw new AccessError(404, "NOT_FOUND");
      const audit = await tx.auditEvent.findMany({
        where: { targetId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return { member, audit };
    },
    db,
  );
  const sessions = await source.db.authSession.findMany({
    where: { userId: data.member.userId, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, expiresAt: true, mfaVerifiedAt: true },
  });
  return { audit: data.audit, sessions };
}
export function auditData(
  context: Context,
  action: string,
  targetId: string,
  summary: Prisma.InputJsonValue,
  legalEntityId?: string,
) {
  return {
    tenantId: context.tenantId,
    actorId: context.userId,
    action,
    targetId,
    summary,
    legalEntityId,
  };
}
