// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { developmentTarget } from "../src/server/db/target";

const require = createRequire(import.meta.url);
const loader = pathToFileURL(require.resolve("tsx")).href;
const runner = resolve("scripts/db/migrate.ts");
const envModule = pathToFileURL(resolve("scripts/db/migration-env.ts")).href;
const canary = "FICTIONAL-ENV-SECRET-DO-NOT-LOG-4e8c!@";
let directory: string;
const baseEnv: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  APPDATA: process.env.APPDATA,
  NODE_ENV: "development",
};
function child(
  script: string,
  args: string[] = [],
  env: Partial<NodeJS.ProcessEnv> = {},
) {
  return spawnSync(process.execPath, ["--import", loader, script, ...args], {
    cwd: directory,
    env: { ...baseEnv, ...env },
    windowsHide: true,
    shell: false,
    encoding: "utf8",
    timeout: 12000,
  });
}
function safeOutput(result: ReturnType<typeof child>) {
  const output = result.stdout + result.stderr;
  expect(output).not.toContain(canary);
  expect(output).not.toContain(encodeURIComponent(canary));
  expect(output).not.toContain("postgresql://");
  expect(output).not.toContain("TypeError");
  return output;
}
beforeEach(async () => {
  directory = await mkdtemp(join(resolve(".data"), "env-loader-"));
});
afterEach(async () => {
  const target = resolve(directory);
  if (
    dirname(target) !== resolve(".data") ||
    !basename(target).startsWith("env-loader-")
  )
    throw Error("TEST_CLEANUP_REJECTED");
  await rm(target, { recursive: true, force: true });
});
describe("real Next env API and runner entry", () => {
  it("reproduces the CJS export contract: named API, no default", () => {
    const api = require("@next/env");
    expect(api.__esModule).toBe(true);
    expect(Object.hasOwn(api, "default")).toBe(false);
    expect(typeof api.loadEnvConfig).toBe("function");
    expect(require("@next/env/package.json").version).toBe(
      require("next/package.json").version,
    );
  });
  it("loads an actual .env.local via the shared real module without revealing values", async () => {
    await writeFile(
      join(directory, ".env.local"),
      `DIRECT_DATABASE_URL=fictional-value\nSENTINEL=${canary}\n`,
    );
    const probe = join(directory, "probe.mts");
    await writeFile(
      probe,
      `import {loadMigrationEnvironment} from ${JSON.stringify(envModule)};const result=loadMigrationEnvironment(false);console.log(JSON.stringify({files:result.loadedFiles,present:!!process.env.DIRECT_DATABASE_URL,sentinelLoaded:!!process.env.SENTINEL}));`,
    );
    const result = child(probe);
    expect(result.status).toBe(0);
    expect(safeOutput(result)).toContain('"sentinelLoaded":true');
    expect(result.stdout).toContain(".env.local");
  });
  it("rejects missing env through the real CLI rather than a loader TypeError", () => {
    const result = child(runner);
    expect(result.status).toBe(1);
    expect(safeOutput(result)).toContain("MIGRATION_ENV_MISSING");
  });
  it("does not borrow the workspace real env when the test cwd has no URL", async () => {
    await writeFile(join(directory, ".env.local"), `SENTINEL=${canary}\n`);
    const result = child(runner);
    expect(result.status).toBe(1);
    expect(safeOutput(result)).toContain("MIGRATION_ENV_MISSING");
  });
  const url = `postgresql://neondb_owner:${encodeURIComponent(canary)}@${developmentTarget.host}/${developmentTarget.database}?sslmode=verify-full`;
  for (const [label, value, code] of [
    ["invalid URL", `invalid-${canary}`, "MIGRATION_SAFETY_FAILED"],
    [
      "wrong role",
      url.replace("neondb_owner", "pusula_runtime"),
      "MIGRATION_ROLE_REJECTED",
    ],
    [
      "wrong database",
      url.replace("/pusula_development", "/unapproved"),
      "MIGRATION_SAFETY_FAILED",
    ],
    [
      "pooled host",
      url.replace(".c-8.", "-pooler.c-8."),
      "MIGRATION_SAFETY_FAILED",
    ],
    [
      "TLS disabled",
      url.replace("verify-full", "disable"),
      "MIGRATION_SAFETY_FAILED",
    ],
  ])
    it(`real CLI rejects ${label} and redacts secrets before any DB connection`, async () => {
      await writeFile(
        join(directory, ".env.local"),
        `DIRECT_DATABASE_URL=${value}\nSENTINEL=${canary}\n`,
      );
      const result = child(runner);
      expect(result.status).toBe(1);
      expect(safeOutput(result)).toContain(code);
    });
  it("production stops before env load or target connection", async () => {
    await writeFile(
      join(directory, ".env.local"),
      `DIRECT_DATABASE_URL=${url}\n`,
    );
    const result = child(runner, [], { NODE_ENV: "production" });
    expect(result.status).toBe(1);
    expect(safeOutput(result)).toContain("PRODUCTION_FORBIDDEN");
  });
  it("real Neon test mode remains forbidden after actual env loading", async () => {
    await writeFile(
      join(directory, ".env.local"),
      `TEST_DIRECT_DATABASE_URL=${url.replace("/pusula_development", "/pusula_sprint_b_test")}\n`,
    );
    const result = child(runner, ["--test"]);
    expect(result.status).toBe(1);
    expect(safeOutput(result)).toContain("REMOTE_TEST_NOT_APPROVED");
  });
  it("a fixture flag cannot redirect loader to an unmarked directory", () => {
    const result = child(runner, ["--test"], {
      PUSULA_LOCAL_FIXTURE: "ed6f496f-f45e-410f-9659-cf444338496a",
      NODE_ENV: "test",
    });
    expect(result.status).toBe(1);
    expect(safeOutput(result)).toContain("FIXTURE_ENV_REJECTED");
  });
});
