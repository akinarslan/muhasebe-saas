import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createDatabase, databaseHealth } from "../../src/server/db/client";
import { CompanyRepository } from "../../src/server/db/repository";
import { assertDevelopmentTarget } from "../../src/server/db/target";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnvConfig(process.cwd());
assertDevelopmentTarget(process.env.TEST_DIRECT_DATABASE_URL, true, true);
assertDevelopmentTarget(process.env.TEST_DATABASE_URL, true);
const db = createDatabase(process.env.TEST_DATABASE_URL!, true);
const admin = new Client({
  connectionString: process.env.TEST_DIRECT_DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
const tenantA = randomUUID(),
  tenantB = randomUUID(),
  entityA = randomUUID(),
  entityB = randomUUID(),
  entityA2 = randomUUID();
const scopeA = { tenantId: tenantA, legalEntityId: entityA };
const a = new CompanyRepository(db, scopeA);
const b = new CompanyRepository(db, {
  tenantId: tenantB,
  legalEntityId: entityB,
});
const a2 = new CompanyRepository(db, {
  tenantId: tenantA,
  legalEntityId: entityA2,
});
let current = "connection",
  passed = 0;
async function check(name: string, operation: () => Promise<void>) {
  current = name;
  await operation();
  passed++;
  console.log(`PASS ${passed}: ${name}`);
}

async function run() {
  await admin.connect();
  await check("real PostgreSQL / restricted non-owner runtime", async () => {
    const rows = await db.$queryRaw<
      { db: string; elevated: boolean; owns: boolean }[]
    >`
      SELECT current_database() AS db,
      (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR pg_has_role(current_user,'neon_superuser','USAGE')) AS elevated,
      EXISTS(SELECT 1 FROM pg_class WHERE relowner = (SELECT oid FROM pg_roles WHERE rolname=current_user) AND relname='Customer') AS owns
      FROM pg_roles WHERE rolname=current_user`;
    assert.equal(rows[0].db, "pusula_sprint_b_test");
    assert.equal(rows[0].elevated, false);
    assert.equal(rows[0].owns, false);
    const migrations = await admin.query(
      'SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    );
    assert.equal(migrations.rows[0].n, readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).length);
  });
  // Synthetic fixtures only; never import localStorage, production or user data.
  await admin.query('INSERT INTO "Tenant" (id,name) VALUES ($1,$2),($3,$4)', [
    tenantA,
    "Sprint B fixture A",
    tenantB,
    "Sprint B fixture B",
  ]);
  await admin.query(
    'INSERT INTO "LegalEntity" (id,"tenantId",name) VALUES ($1,$2,$3),($4,$5,$6),($7,$2,$8)',
    [
      entityA,
      tenantA,
      "Fixture A",
      entityB,
      tenantB,
      "Fixture B",
      entityA2,
      "Fixture A2",
    ],
  );
  const sourceId = randomUUID();
  const customer = await a.createCustomer({ sourceId, name: "Test atölyesi" });
  await check(
    "typed CRUD, duplicate rejection and version increment",
    async () => {
      assert.equal((await a.customer(customer.id))?.name, "Test atölyesi");
      assert.equal(
        (await a.renameCustomer(customer.id, "Güncel test adı")).count,
        1,
      );
      assert.equal((await a.customer(customer.id))?.version, 2);
      await assert.rejects(
        a.createCustomer({ sourceId, name: "Mükerrer test" }),
      );
      const disposable = await a.createCustomer({
        sourceId: randomUUID(),
        name: "Silinebilir test",
      });
      assert.equal((await a.deleteCustomer(disposable.id)).count, 1);
      assert.equal(await a.customer(disposable.id), null);
    },
  );
  await check(
    "real RLS: cross-tenant and cross-company reads/writes denied",
    async () => {
      assert.deepEqual(await b.customers(), []);
      assert.deepEqual(await a2.customers(), []);
      // Deliberately omit all application tenant filters: database policy must hold.
      assert.equal(
        await b.transaction((tx) =>
          tx.customer.findUnique({ where: { id: customer.id } }),
        ),
        null,
      );
      assert.equal(
        await a2.transaction((tx) =>
          tx.customer.findUnique({ where: { id: customer.id } }),
        ),
        null,
      );
      assert.equal(
        (await b.renameCustomer(customer.id, "Yetkisiz test")).count,
        0,
      );
      await assert.rejects(
        a.transaction((tx) =>
          tx.customer.create({
            data: {
              tenantId: tenantB,
              legalEntityId: entityB,
              sourceId: randomUUID(),
              name: "Yanlış kapsam",
            },
          }),
        ),
      );
    },
  );
  await check(
    "missing scope fails closed; pooled transaction context does not leak",
    async () => {
      assert.deepEqual(await db.customer.findMany(), []);
      const result = await db.$queryRaw<
        { scope: string | null }[]
      >`SELECT current_setting('app.tenant_id',true) AS scope`;
      assert.ok(!result[0].scope);
      await assert.rejects(
        db.customer.create({
          data: { ...scopeA, sourceId: randomUUID(), name: "Kapsamsız test" },
        }),
      );
    },
  );
  await check(
    "composite foreign key prevents cross-tenant company relation",
    async () => {
      await assert.rejects(
        admin.query(
          'INSERT INTO "Customer" (id,"tenantId","legalEntityId","sourceId",name) VALUES ($1,$2,$3,$4,$5)',
          [randomUUID(), tenantA, entityB, randomUUID(), "Yanlış ilişki"],
        ),
        { code: "23503" },
      );
    },
  );
  const material = await a.transaction((tx) =>
    tx.material.create({
      data: {
        ...scopeA,
        name: "Fixture folyo",
        unit: "square_meter",
        roll: true,
      },
    }),
  );
  const variant = await a.transaction((tx) =>
    tx.materialVariant.create({
      data: {
        ...scopeA,
        materialId: material.id,
        name: "152 cm",
        widthCm: "152",
        usdCost: "1.2",
        inStock: true,
      },
    }),
  );
  await check("numeric USD precision and atomic price history", async () => {
    const changed = await a.changeUsdCost(
      variant.id,
      "1.234567",
      "sprint-b-verification",
    );
    assert.equal(changed.usdCost?.toFixed(6), "1.234567");
    const history = await a.transaction((tx) =>
      tx.materialPriceHistory.findMany({ where: { variantId: variant.id } }),
    );
    assert.equal(history.length, 1);
    assert.equal(history[0].previousUsd?.toString(), "1.2");
    assert.equal(history[0].nextUsd.toFixed(6), "1.234567");
    const sum = await db.$queryRaw<
      { sum: string }[]
    >`SELECT (0.1::numeric + 0.2::numeric)::text AS sum`;
    assert.equal(sum[0].sum, "0.3");
    await assert.rejects(async () =>
      a.changeUsdCost(variant.id, "1.2345678", "test"),
    );
    await assert.rejects(
      a.transaction((tx) =>
        tx.materialVariant.update({
          where: { id: variant.id },
          data: { usdCost: "-1" },
        }),
      ),
    );
  });
  await check("history immutable for runtime and migration role", async () => {
    await assert.rejects(
      a.transaction((tx) => tx.materialPriceHistory.deleteMany()),
    );
    await assert.rejects(
      admin.query(
        'UPDATE "MaterialPriceHistory" SET "nextUsd"=9 WHERE "variantId"=$1',
        [variant.id],
      ),
      { code: "23514" },
    );
    assert.deepEqual(
      await b.transaction((tx) => tx.materialPriceHistory.findMany()),
      [],
    );
  });
  await check("failed transaction rolls back all customer writes", async () => {
    const failedSource = randomUUID();
    await assert.rejects(
      a.transaction(async (tx) => {
        await tx.customer.create({
          data: { ...scopeA, sourceId: failedSource, name: "Rollback fixture" },
        });
        throw new Error("Expected fixture rollback");
      }),
    );
    assert.equal(
      (await a.customers()).some((c) => c.sourceId === failedSource),
      false,
    );
  });
  await check(
    "runtime cannot create tables or inspect migration records",
    async () => {
      await assert.rejects(
        db.$executeRawUnsafe(
          "CREATE TABLE public.forbidden_sprint_b_probe (id integer)",
        ),
      );
      await assert.rejects(db.$queryRaw`SELECT * FROM "_prisma_migrations"`);
    },
  );
  await check(
    "real connectivity health and safe authentication failure",
    async () => {
      assert.equal(await databaseHealth(() => db), true);
      const wrong = new URL(process.env.TEST_DATABASE_URL!);
      wrong.password = randomUUID();
      const broken = createDatabase(wrong.toString(), true);
      try {
        assert.equal(await databaseHealth(() => broken), false);
      } finally {
        await broken.$disconnect();
      }
    },
  );
  await check(
    "TCP connection refusal returns safe unavailable status",
    async () => {
      // Independent loopback fault probe: no Neon endpoint is suspended or changed.
      const unreachable = new PrismaClient({
        adapter: new PrismaPg({
          host: "127.0.0.1",
          port: 1,
          database: "fault_probe",
          user: "fixture",
          password: "fixture",
          connectionTimeoutMillis: 1000,
          max: 1,
        }),
        log: [],
      });
      try {
        assert.equal(await databaseHealth(() => unreachable), false);
      } finally {
        await unreachable.$disconnect();
      }
    },
  );
  console.log(
    `SPRINT B: ${passed}/${passed} real database checks passed. Synthetic fixtures retained only in the isolated test database.`,
  );
}
run()
  .catch((error: unknown) => {
    console.error(
      `FAIL: ${current}. Database payloads, SQL and credentials suppressed.`,
    );
    if (error && typeof error === "object" && "code" in error)
      console.error(`Code: ${String(error.code).replace(/[^A-Z0-9_]/gi, "")}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await admin.end();
  });
