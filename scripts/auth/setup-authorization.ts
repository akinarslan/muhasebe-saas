import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";

import { permissions, roleTemplates } from "../../src/lib/auth/catalog";
import { assertDevelopmentTarget } from "../../src/server/db/target";
loadEnvConfig(process.cwd());
async function run() {
  for (const test of [false, true]) {
    const url =
      process.env[test ? "TEST_DIRECT_DATABASE_URL" : "DIRECT_DATABASE_URL"]!;
    assertDevelopmentTarget(url, test, true);
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url, max: 1 }),
    });
    const admin = new Client({
      connectionString: url,
      connectionTimeoutMillis: 10000,
    });
    await admin.connect();
    try {
      await db.$transaction(
        async (tx) => {
          for (const p of permissions)
            await tx.permission.upsert({
              where: { id: p.id },
              create: p,
              update: { label: p.label, module: p.module },
            });
          for (const r of roleTemplates) {
            await tx.role.upsert({
              where: { id: r.id },
              create: { id: r.id, name: r.name },
              update: { name: r.name },
            });
            for (const p of r.permissions)
              await tx.rolePermission.upsert({
                where: {
                  roleId_permissionId: { roleId: r.id, permissionId: p },
                },
                create: { roleId: r.id, permissionId: p },
                update: {},
              });
          }
          for (const boot of await tx.authBootstrap.findMany()) {
            const member = await tx.membership.upsert({
              where: {
                tenantId_userId: {
                  tenantId: boot.tenantId,
                  userId: boot.userId,
                },
              },
              create: {
                tenantId: boot.tenantId,
                userId: boot.userId,
                isMaster: true,
              },
              update: {},
            });
            if (
              !(await tx.roleAssignment.findFirst({
                where: { membershipId: member.id, roleId: "MASTER" },
              }))
            ) {
              const scope = await tx.permissionScope.create({
                data: { tenantId: boot.tenantId, kind: "TENANT" },
              });
              await tx.roleAssignment.create({
                data: {
                  tenantId: boot.tenantId,
                  membershipId: member.id,
                  roleId: "MASTER",
                  scopeId: scope.id,
                },
              });
              await tx.auditEvent.create({
                data: {
                  tenantId: boot.tenantId,
                  actorId: boot.userId,
                  targetId: member.id,
                  action: "MASTER_MEMBERSHIP_BOOTSTRAP",
                  summary: { mfaRequired: true },
                },
              });
            }
          }
        },
        { timeout: 120000 },
      );
      const role = test ? "pusula_test_runtime" : "pusula_runtime";
      await admin.query(
        `GRANT SELECT ON "Role","Permission","RolePermission" TO "${role}"`,
      );
      await admin.query(
        `GRANT SELECT,INSERT,UPDATE,DELETE ON "Membership","RoleAssignment","UserPermissionOverride","PermissionScope" TO "${role}"`,
      );
      await admin.query(`GRANT SELECT,INSERT ON "AuditEvent" TO "${role}"`);
      console.log(
        `Authorization templates and restricted grants verified: ${test ? "test" : "development"}`,
      );
    } finally {
      await db.$disconnect();
      await admin.end();
    }
  }
}
run().catch(() => {
  console.error("Authorization setup failed; sensitive details suppressed.");
  process.exitCode = 1;
});
