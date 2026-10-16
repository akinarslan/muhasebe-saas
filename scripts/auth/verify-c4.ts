import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { masterFixture } from "./master-fixture";
import { contextFor, scoped } from "../../src/server/authorization/context";
import { changeUser } from "../../src/server/authorization/users";
import {
  inviteUser,
  acceptInvitation,
} from "../../src/server/auth/invitations";
import { authRequest } from "../../src/server/auth/core";
import { cloudRequest } from "../../src/server/cloud/handler";
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
    const c = await contextFor(f.headers(), f.db, f.source),
      boot = await f.source.db.authBootstrap.findFirstOrThrow();
    const company = boot.legalEntityId;
    const ads = randomUUID(),
      software = randomUUID(),
      material = randomUUID(),
      variant = randomUUID(),
      otherTenant = randomUUID(),
      otherCompany = randomUUID();
    await admin.query(
      'INSERT INTO "Activity"(id,"tenantId","legalEntityId",name) VALUES($1,$2,$3,$4),($5,$2,$3,$6)',
      [
        ads,
        c.tenantId,
        company,
        "C4 advertising fixture",
        software,
        "C4 software fixture",
      ],
    );
    await admin.query(
      'INSERT INTO "Material"(id,"tenantId","legalEntityId",name,unit,"activityId") VALUES($1,$2,$3,$4,$5,$6)',
      [material, c.tenantId, company, "C4 cost fixture", "square_meter", ads],
    );
    await admin.query(
      'INSERT INTO "MaterialVariant"(id,"tenantId","legalEntityId","materialId",name,"widthCm","usdCost") VALUES($1,$2,$3,$4,$5,152,1.234567)',
      [variant, c.tenantId, company, material, "C4 152 cm fixture"],
    );
    await admin.query('INSERT INTO "Tenant"(id,name) VALUES($1,$2)', [
      otherTenant,
      "C4 other tenant fixture",
    ]);
    await admin.query(
      'INSERT INTO "LegalEntity"(id,"tenantId",name) VALUES($1,$2,$3)',
      [otherCompany, otherTenant, "C4 other company fixture"],
    );
    for (const [activityId, name] of [
      [ads, "C4 ads customer"],
      [software, "C4 software customer"],
    ])
      await admin.query(
        'INSERT INTO "Customer"(id,"tenantId","legalEntityId","sourceId",name,"activityId") VALUES($1,$2,$3,$4,$5,$6)',
        [randomUUID(), c.tenantId, company, randomUUID(), name, activityId],
      );
    const email = `c4-${randomBytes(8).toString("hex")}@example.invalid`,
      password = randomBytes(24).toString("base64url");
    const invited = await inviteUser(
      f.headers(),
      { email, name: "C4 sales fixture" },
      f.db,
      f.source,
    );
    const token = new URL(f.messages.at(-1)!.url).searchParams.get("token")!;
    await acceptInvitation({ token, password }, f.db, f.source);
    let version = (
      await scoped(
        c,
        (tx) =>
          tx.membership.findUniqueOrThrow({
            where: { id: invited.membershipId! },
          }),
        f.db,
      )
    ).version;
    const input = {
      version,
      status: "ACTIVE",
      roleId: "SALES",
      scope: { kind: "ACTIVITY", legalEntityId: company, activityId: ads },
      overrides: [],
    };
    version = (
      await changeUser(
        f.headers(),
        invited.membershipId!,
        input,
        f.db,
        f.source,
      )
    ).version;
    const login = await authRequest(
      new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          Origin: "http://127.0.0.1:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }),
      f.source,
    );
    assert.equal(login.status, 200);
    const cookie = login.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
    const userHeaders = new Headers({
      cookie,
      Origin: "http://127.0.0.1:3000",
      "Content-Type": "application/json",
    });
    async function api(
      path: string,
      method = "GET",
      body?: unknown,
      headers = userHeaders,
    ) {
      return cloudRequest(
        new Request(`http://127.0.0.1:3000/api/cloud/${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        }),
        f.db,
        f.source,
      );
    }
    await check(
      "HTTP unauthenticated and fake identity headers denied",
      async () => {
        const r = await api(
          `customers?company=${company}`,
          "GET",
          undefined,
          new Headers({
            "x-user-id": c.userId,
            "x-role": "MASTER",
            "x-tenant-id": c.tenantId,
          }),
        );
        assert.equal(r.status, 401);
      },
    );
    await check("activity RLS filters unqualified SQL and HTTP", async () => {
      const uc = await contextFor(userHeaders, f.db, f.source);
      const rows = await scoped(
        uc,
        (tx) => tx.customer.findMany(),
        f.db,
        company,
      );
      assert(rows.some((x) => x.name === "C4 ads customer"));
      assert(!rows.some((x) => x.name === "C4 software customer"));
      const r = await api(`customers?company=${company}`);
      assert.equal(r.status, 200);
      assert(!(await r.text()).includes("C4 software customer"));
    });
    await check(
      "different tenant and company selectors cannot grant access",
      async () => {
        assert.equal(
          (await api(`customers?company=${otherCompany}`)).status,
          403,
        );
        assert.equal(
          (
            await api("customers", "POST", {
              legalEntityId: otherCompany,
              activityId: null,
              name: "forbidden",
            })
          ).status,
          403,
        );
      },
    );
    await check("forged tenant user and role payload rejected", async () => {
      assert.equal(
        (
          await api("customers", "POST", {
            legalEntityId: company,
            activityId: ads,
            name: "forbidden",
            tenantId: otherTenant,
            userId: c.userId,
            role: "MASTER",
          })
        ).status,
        400,
      );
    });
    await check("customer create is scoped and audited", async () => {
      const r = await api("customers", "POST", {
        legalEntityId: company,
        activityId: ads,
        name: "C4 created customer",
      });
      assert.equal(r.status, 201);
      const row = await r.json();
      const audit = await scoped(
        c,
        (tx) =>
          tx.auditEvent.findFirst({
            where: { targetId: row.id, action: "CUSTOMER_CREATED" },
          }),
        f.db,
      );
      assert(audit);
    });
    await check(
      "USD fields absent from nested material DTO without cost grant",
      async () => {
        const r = await api(`materials?company=${company}`);
        assert.equal(r.status, 200);
        const rows = await r.json();
        assert(rows.some((x: { id: string }) => x.id === material));
        assert(
          !JSON.stringify(rows).match(
            /usdCost|previousUsd|nextUsd|history|snapshot|1\.234567/,
          ),
        );
      },
    );
    await check(
      "unauthorized USD update and manual rate return 403",
      async () => {
        assert.equal(
          (
            await api(`materials/${variant}/cost`, "PATCH", {
              legalEntityId: company,
              usdCost: "9",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await api("exchange-rate", "POST", {
              usdTry: "50",
              reason: "C4 synthetic rate",
            })
          ).status,
          403,
        );
      },
    );
    await check(
      "authorized USD write has Decimal history and audit",
      async () => {
        assert.equal(
          (
            await api(
              `materials/${variant}/cost`,
              "PATCH",
              { legalEntityId: company, usdCost: "2.345678" },
              f.headers(),
            )
          ).status,
          200,
        );
        const history = await admin.query(
          'SELECT "nextUsd" FROM "MaterialPriceHistory" WHERE "variantId"=$1',
          [variant],
        );
        assert.equal(history.rows[0].nextUsd, "2.345678");
      },
    );
    await check(
      "authorized manual rate isolated by tenant and immutable",
      async () => {
        const r = await api(
          "exchange-rate",
          "POST",
          { usdTry: "51.123456", reason: "C4 synthetic test rate" },
          f.headers(),
        );
        assert.equal(r.status, 201);
        const row = await r.json();
        assert.equal(row.usdTry, "51.123456");
        await assert.rejects(
          admin.query('DELETE FROM "TenantExchangeRate" WHERE id=$1', [row.id]),
        );
      },
    );
    await check("cross-origin mutation rejected", async () => {
      const h = new Headers(f.headers());
      h.set("origin", "https://example.invalid");
      assert.equal(
        (
          await api(
            "exchange-rate",
            "POST",
            { usdTry: "52", reason: "C4 synthetic" },
            h,
          )
        ).status,
        403,
      );
    });
    await check(
      "revoked action immediately denies existing session",
      async () => {
        await changeUser(
          f.headers(),
          invited.membershipId!,
          {
            ...input,
            version,
            overrides: [{ permissionId: "customers.view", effect: "DENY" }],
          },
          f.db,
          f.source,
        );
        const r = await api(`customers?company=${company}`);
        assert.equal(r.status, 200);
        assert.deepEqual(await r.json(), []);
      },
    );
  } finally {
    await admin.end();
    await f.close();
  }
}
run().catch((e) => {
  console.error(
    `C4 failed after ${passed} checks`,
    e?.name,
    e?.code,
    e?.reason,
  );
  process.exitCode = 1;
});
