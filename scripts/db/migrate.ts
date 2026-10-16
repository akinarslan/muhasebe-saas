import { loadEnvConfig } from "@next/env";
import { spawnSync } from "node:child_process";
import { assertDevelopmentTarget } from "../../src/server/db/target";
loadEnvConfig(process.cwd());
const test = process.argv.includes("--test");
assertDevelopmentTarget(
  process.env[test ? "TEST_DIRECT_DATABASE_URL" : "DIRECT_DATABASE_URL"],
  test,
  true,
);
const result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--config",
    "prisma7.config.ts",
  ],
  {
    stdio: "pipe",
    env: { ...process.env, PUSULA_DB_TARGET: test ? "test" : "development" },
    encoding: "utf8",
  },
);
// Prisma may render datasource URLs on errors: never forward its raw output.
if (result.status !== 0) {
  console.error(
    "Migration failed on the allowlisted development target; inspect locally without exposing credentials.",
  );
  process.exitCode = 1;
} else
  console.log(
    `Migration deployed: ${test ? "isolated test" : "development"} database`,
  );
