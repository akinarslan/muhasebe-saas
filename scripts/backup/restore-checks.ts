// Same PG18 parser round-trip as the existing accounting restore fixture.
// Called only after restoreFixture verifies the new local target identity.
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { requireCheck } from "./core";
type Constraint = {
  relname: string;
  conname: string;
  contype: string;
  definition: string;
};
export async function roundTripRestoreChecks(
  db: Client,
  rows: Constraint[],
  tables: readonly string[],
) {
  const schema = `backup_compare_${randomUUID().replaceAll("-", "")}`;
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const created = new Set<string>(),
    normalized: Constraint[] = [],
    changed: string[] = [];
  await db.query(`CREATE SCHEMA ${schema}`);
  try {
    for (const row of rows) {
      requireCheck(
        tables.includes(row.relname),
        "RESTORE_CHECK_TABLE_REJECTED",
      );
      if (row.contype !== "c") {
        normalized.push(row);
        continue;
      }
      if (!created.has(row.relname)) {
        await db.query(
          `CREATE TABLE ${schema}.${quote(row.relname)} (LIKE public.${quote(row.relname)} INCLUDING DEFAULTS)`,
        );
        created.add(row.relname);
      }
      await db.query(
        `ALTER TABLE ${schema}.${quote(row.relname)} ADD CONSTRAINT ${quote(row.conname)} ${row.definition}`,
      );
      const definition = (
        await db.query(
          `SELECT pg_get_constraintdef(c.oid) definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relname=$2 AND c.conname=$3`,
          [schema, row.relname, row.conname],
        )
      ).rows[0].definition;
      if (definition !== row.definition)
        changed.push(`${row.relname}.${row.conname}`);
      normalized.push({ ...row, definition });
    }
  } finally {
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
  }
  return { normalized, changed };
}
