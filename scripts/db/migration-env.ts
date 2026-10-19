import { loadEnvConfig } from "@next/env";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { check, MigrationSafetyError } from "./migration-safety";

// @next/env exports a named API, not a CommonJS default export. Never return or
// print its combinedEnv/parsedEnv/loaded file contents: they contain credentials.
export function loadMigrationEnvironment(test: boolean) {
  check(process.env.NODE_ENV !== "production", "PRODUCTION_FORBIDDEN");
  check(typeof loadEnvConfig === "function", "MIGRATION_ENV_API_UNAVAILABLE");
  let directory = process.cwd();
  const id = process.env.PUSULA_LOCAL_FIXTURE;
  if (id) {
    check(test, "FIXTURE_ENV_REQUIRES_TEST");
    check(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id),
      "FIXTURE_ENV_REJECTED",
    );
    const root = resolve(".data/fixtures", `v42-${id}`);
    try {
      check(
        !lstatSync(root).isSymbolicLink() && realpathSync(root) === root,
        "FIXTURE_ENV_REJECTED",
      );
      const marker = join(root, "target.json");
      check(!lstatSync(marker).isSymbolicLink(), "FIXTURE_ENV_REJECTED");
      check(
        JSON.parse(readFileSync(marker, "utf8")).id === id,
        "FIXTURE_ENV_REJECTED",
      );
      directory = join(root, "migration-env");
      check(
        !lstatSync(directory).isSymbolicLink() &&
          realpathSync(directory) === directory,
        "FIXTURE_ENV_REJECTED",
      );
    } catch {
      throw new MigrationSafetyError("FIXTURE_ENV_REJECTED");
    }
  }
  try {
    // Test mode reads only the private UUID env directory, never real .env.local.
    // Both modes call the same genuine Next API; no fixture bypass or mock.
    const result = loadEnvConfig(
      directory,
      true,
      { info() {}, error() {} },
      true,
    );
    return { loadedFiles: result.loadedEnvFiles.map((file) => file.path) };
  } catch {
    throw new MigrationSafetyError("MIGRATION_ENV_LOAD_FAILED");
  }
}
