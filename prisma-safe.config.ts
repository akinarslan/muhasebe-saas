import { defineConfig } from "prisma/config";
import { realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { migrationTarget, check } from "./scripts/db/migration-safety";
const test = process.env.PUSULA_DB_TARGET === "test";
const url = migrationTarget(
  process.env[test ? "TEST_DIRECT_DATABASE_URL" : "DIRECT_DATABASE_URL"],
  test,
);
check(
  /^[a-f0-9-]{36}$/.test(process.env.PUSULA_MIGRATION_RUN_ID ?? ""),
  "RUNNER_REQUIRED",
);
url.searchParams.set(
  "application_name",
  `pusula_migrate_${process.env.PUSULA_MIGRATION_RUN_ID}`,
);
const caPath = test
  ? process.env.PUSULA_FIXTURE_TLS_CA
  : process.env.BACKUP_PG_SSLROOTCERT;
if (!test || caPath) {
  check(!!caPath, "CA_REQUIRED");
  if (test) {
    const root = resolve(
      ".data/fixtures",
      `v42-${process.env.PUSULA_LOCAL_FIXTURE}`,
    );
    check(dirname(realpathSync(caPath!)) === root, "FIXTURE_CA_REJECTED");
  }
  // The engine uses require + strict + server CA for verify-full semantics.
  // The operator URL must still pass the original verify-full target guard.
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("sslcert", resolve(caPath!));
  url.searchParams.set("sslaccept", "strict");
}
// Canonical017 must never be swept into the legacy cloud/016 deploy path.
check(
  !!process.env.PUSULA_MIGRATION_FIXTURE_DIR,
  "EXPLICIT_PHASE_RUNNER_REQUIRED",
);
let migrationPath = "prisma/migrations";
if (process.env.PUSULA_MIGRATION_FIXTURE_DIR) {
  check(test, "FIXTURE_MIGRATIONS_FORBIDDEN");
  const expected = resolve(
    ".data/fixtures",
    `v42-${process.env.PUSULA_LOCAL_FIXTURE}`,
    "migrations",
  );
  check(
    resolve(process.env.PUSULA_MIGRATION_FIXTURE_DIR) === expected &&
      realpathSync(expected) === expected,
    "FIXTURE_MIGRATIONS_REJECTED",
  );
  migrationPath = expected;
}
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: migrationPath },
  datasource: { url: url.toString() },
});
