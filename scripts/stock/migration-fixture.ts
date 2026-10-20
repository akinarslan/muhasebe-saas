import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { catalog, hash, migrationTarget, check } from "../db/migration-safety";
import { runPrisma } from "../db/migrate";
export async function verifyStockMigration(
  db: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
  measure = false,
) {
  const url = env.TEST_DIRECT_DATABASE_URL;
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    migrationTarget(url, true);
    const old = JSON.parse(
      await readFile("scripts/db/migration-baseline.json", "utf8"),
    );
    const before = await catalog(db);
    for (const [k, v] of Object.entries(before))
      check(hash(v) === old.appliedSchema[k], "STOCK_PRE_SCHEMA_" + k);
    const sql = await readFile(
      "prisma/migrations/202610210016_goods_receipts/migration.sql",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    let pin: { checksum: string; schema: Record<string, string> } | undefined;
    if (!measure) {
      pin = JSON.parse(
        await readFile("scripts/stock/migration-baseline.json", "utf8"),
      );
      check(pin!.checksum === checksum, "STOCK_CHECKSUM");
    }
    const sentinelTenant = crypto.randomUUID(),
      sentinelEntity = crypto.randomUUID(),
      sentinelMaterial = crypto.randomUUID(),
      sentinelVariant = crypto.randomUUID();
    await db.query('INSERT INTO "Tenant"(id,name) VALUES($1,$2)', [
      sentinelTenant,
      "Pre016 sentinel",
    ]);
    await db.query(
      'INSERT INTO "LegalEntity"(id,"tenantId",name) VALUES($1,$2,$3)',
      [sentinelEntity, sentinelTenant, "Pre016 entity"],
    );
    await db.query(
      'INSERT INTO "Material"(id,"tenantId","legalEntityId",name,unit) VALUES($1,$2,$3,$4,$5)',
      [
        sentinelMaterial,
        sentinelTenant,
        sentinelEntity,
        "Pre016 cost sentinel",
        "square_meter",
      ],
    );
    await db.query(
      'INSERT INTO "MaterialVariant"(id,"tenantId","legalEntityId","materialId",name,"widthCm","usdCost") VALUES($1,$2,$3,$4,$5,152,7.123456)',
      [
        sentinelVariant,
        sentinelTenant,
        sentinelEntity,
        sentinelMaterial,
        "Pre016 variant",
      ],
    );
    const contents = await db.query(
      `SELECT 'MaterialVariant' tab,md5(coalesce(string_agg(to_jsonb(v)::text,'' ORDER BY id),'')) digest FROM "MaterialVariant" v UNION ALL SELECT 'CloudSaleLine',md5(coalesce(string_agg(to_jsonb(l)::text,'' ORDER BY id),'')) FROM "CloudSaleLine" l`,
    );
    await runPrisma(db, env);
    const cat = await catalog(db);
    const schema = Object.fromEntries(
      Object.entries(cat).map(([k, v]) => [k, hash(v)]),
    );
    await writeFile(
      join(dir, "stock-schema-measured.json"),
      JSON.stringify({ checksum, schema }, null, 2),
    );
    if (pin)
      for (const k of Object.keys(schema))
        check(schema[k] === pin.schema[k], "STOCK_POST_SCHEMA_" + k);
    check(
      cat.tables.length === 47 &&
        cat.tables.filter((t) => t.relforcerowsecurity).length === 33,
      "STOCK_TABLES",
    );
    const after = await db.query(
      `SELECT 'MaterialVariant' tab,md5(coalesce(string_agg(to_jsonb(v)::text,'' ORDER BY id),'')) digest FROM "MaterialVariant" v UNION ALL SELECT 'CloudSaleLine',md5(coalesce(string_agg(to_jsonb(l)::text,'' ORDER BY id),'')) FROM "CloudSaleLine" l`,
    );
    check(
      JSON.stringify(contents.rows) === JSON.stringify(after.rows),
      "STOCK_OLD_CONTENT",
    );
    check(
      !(
        await db.query(
          `SELECT rolsuper OR rolbypassrls OR rolcanlogin OR rolcreatedb OR rolcreaterole AS unsafe FROM pg_roles WHERE rolname='pusula_stock_executor'`,
        )
      ).rows[0].unsafe,
      "EXECUTOR_ROLE",
    );
    check(
      (
        await db.query(
          `SELECT count(*)::int n FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner='pusula_stock_executor'::regrole`,
        )
      ).rows[0].n === 0,
      "EXECUTOR_NON_OWNER",
    );
    console.log(
      JSON.stringify({
        stockMigration: "PASS",
        realPrisma: true,
        checksum,
        pinned: !!pin,
      }),
    );
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}
