import { loadEnvConfig } from "@next/env";
import { spawn } from "node:child_process";
import { assertDevelopmentTarget } from "../../src/server/db/target";
loadEnvConfig(process.cwd());
assertDevelopmentTarget(process.env.TEST_DATABASE_URL, true);
assertDevelopmentTarget(process.env.TEST_AUTH_DATABASE_URL, true);
if (!process.env.AUTH_TEST_SECRET) throw new Error("Missing test auth secret");
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PUSULA_AUTH_E2E: "1",
      PUSULA_DB_TARGET: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      AUTH_DATABASE_URL: process.env.TEST_AUTH_DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_TEST_SECRET,
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
