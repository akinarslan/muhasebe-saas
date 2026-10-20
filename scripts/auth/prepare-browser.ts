import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { symmetricEncrypt } from "better-auth/crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createAuth, provisionIdentity } from "../../src/server/auth/core";
import { assertDevelopmentTarget } from "../../src/server/db/target";
import { fixtureFile } from "./fixture-files";
loadEnvConfig(process.cwd());
async function run() {
  assertDevelopmentTarget(process.env.TEST_DIRECT_DATABASE_URL, true, true);
  const admin = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.TEST_DIRECT_DATABASE_URL,
      max: 1,
    }),
  });
  const source = createAuth(
    process.env.TEST_AUTH_DATABASE_URL!,
    process.env.AUTH_TEST_SECRET!,
    true,
  );
  const fixtures: Record<string, unknown> = {};
  try {
    for (const project of process.env.PUSULA_STOCK_FIXTURE === "1"
      ? ["desktop", "mobile", "stock-desktop", "stock-mobile"]
      : ["desktop", "mobile"]) {
      const tenant = await admin.tenant.create({
        data: { name: `Browser ${project} isolated tenant` },
      });
      await admin.legalEntity.create({
        data: { tenantId: tenant.id, name: `Browser ${project} company` },
      });
      const email = `browser-master-${randomBytes(8).toString("hex")}@example.invalid`,
        password = randomBytes(24).toString("base64url");
      const master = await provisionIdentity(() =>
        source.auth.api.signUpEmail({
          body: { email, password, name: `Browser ${project} master` },
        }),
      );
      const targetName = `Browser ${project} sales ${randomBytes(4).toString("hex")}`;
      await admin.tenantExchangeRate.create({
        data: {
          tenantId: tenant.id,
          actorId: master.user.id,
          usdTry: "50",
          reason: "Isolated browser fixture only",
          publishedAt: new Date("2026-10-17"),
        },
      });
      const target = await provisionIdentity(() =>
        source.auth.api.signUpEmail({
          body: {
            email: `browser-sales-${randomBytes(8).toString("hex")}@example.invalid`,
            password: randomBytes(24).toString("base64url"),
            name: targetName,
          },
        }),
      );
      for (const [user, roleId] of [
        [master, "MASTER"],
        [target, "SALES"],
      ] as const) {
        await admin.$transaction(async (tx) => {
          const member = await tx.membership.create({
            data: {
              tenantId: tenant.id,
              userId: user.user.id,
              isMaster: roleId === "MASTER",
            },
          });
          const scope = await tx.permissionScope.create({
            data: { tenantId: tenant.id, kind: "TENANT" },
          });
          await tx.roleAssignment.create({
            data: {
              tenantId: tenant.id,
              membershipId: member.id,
              roleId,
              scopeId: scope.id,
            },
          });
        });
      }
      await source.db.authSession.deleteMany({
        where: { userId: { in: [master.user.id, target.user.id] } },
      });
      fixtures[project] = { email, password, targetName };
    }
    await source.db.authRateLimit.deleteMany();
    await mkdir(".data", { recursive: true });
    await writeFile(
      fixtureFile("auth-browser-fixtures.enc"),
      await symmetricEncrypt({
        key: process.env.AUTH_TEST_SECRET!,
        data: JSON.stringify(fixtures),
      }),
      { mode: 0o600 },
    );
    console.log(
      "Isolated synthetic browser fixtures prepared; credentials encrypted locally.",
    );
  } finally {
    await admin.$disconnect();
    await source.db.$disconnect();
  }
}
run().catch(() => {
  console.error(
    "Browser fixture preparation failed; sensitive details suppressed.",
  );
  process.exitCode = 1;
});
