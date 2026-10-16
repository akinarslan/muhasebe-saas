import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  developmentTarget,
  assertDevelopmentTarget,
} from "../../src/server/db/target";

loadEnvConfig(process.cwd());
const grantOnly = process.argv.includes("--grants");
const seed =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
if (!seed) throw new Error("Missing local direct connection configuration.");
const initial = new URL(seed);
if (initial.hostname !== developmentTarget.host)
  throw new Error("Setup rejected: not the approved development endpoint.");
initial.searchParams.set("sslmode", "verify-full");

async function run() {
  const changes: Record<string, string> = {};
  for (const test of [false, true]) {
    const database = test
      ? developmentTarget.testDatabase
      : developmentTarget.database;
    const role = test ? "pusula_test_runtime" : "pusula_runtime";
    const direct = new URL(initial);
    direct.pathname = `/${database}`;
    assertDevelopmentTarget(direct.toString(), test, true);
    const admin = new Client({
      connectionString: direct.toString(),
      connectionTimeoutMillis: 10000,
    });
    await admin.connect();
    try {
      if (grantOnly) {
        await admin.query(
          `REVOKE CONNECT ON DATABASE "${database}" FROM PUBLIC`,
        );
        await admin.query(
          `GRANT CONNECT ON DATABASE "${database}" TO "${role}"`,
        );
        await admin.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
        await admin.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
        await admin.query(
          `GRANT SELECT ON "Tenant", "LegalEntity", "Activity" TO "${role}"`,
        );
        await admin.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON "Customer", "Material", "MaterialVariant" TO "${role}"`,
        );
        await admin.query(
          `GRANT SELECT, INSERT ON "MaterialPriceHistory" TO "${role}"`,
        );
      } else {
        const exists = await admin.query(
          "SELECT 1 FROM pg_roles WHERE rolname=$1",
          [role],
        );
        let password: string;
        if (exists.rowCount) {
          const stored =
            process.env[test ? "TEST_DATABASE_URL" : "DATABASE_URL"];
          if (!stored || new URL(stored).username !== role)
            throw new Error(
              "Existing role requires matching local credentials; no password was reset.",
            );
          password = decodeURIComponent(new URL(stored).password);
        } else {
          password = randomBytes(32).toString("hex");
          // Role names are constants; password is locally generated hex, never logged.
          await admin.query(
            `CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
          );
        }
        const pooled = new URL(direct);
        pooled.hostname = developmentTarget.host.replace(
          ".c-8.",
          "-pooler.c-8.",
        );
        pooled.username = role;
        pooled.password = password;
        changes[test ? "TEST_DATABASE_URL" : "DATABASE_URL"] =
          pooled.toString();
        changes[test ? "TEST_DIRECT_DATABASE_URL" : "DIRECT_DATABASE_URL"] =
          direct.toString();
        if (!test) changes.DATABASE_URL_UNPOOLED = direct.toString();
      }
      console.log(
        `${grantOnly ? "Grants verified" : "Role configured"}: ${database}`,
      );
    } finally {
      await admin.end();
    }
  }
  if (!grantOnly) {
    let env = await readFile(".env.local", "utf8");
    for (const [key, value] of Object.entries(changes)) {
      const line = `${key}=${JSON.stringify(value)}`;
      const pattern = new RegExp(`^${key}=.*$`, "m");
      env = pattern.test(env)
        ? env.replace(pattern, () => line)
        : `${env.trimEnd()}\n${line}\n`;
    }
    await writeFile(".env.local", env, { encoding: "utf8", mode: 0o600 });
    console.log("Local environment merged; credentials were not printed.");
  }
}
run().catch((error: unknown) => {
  console.error(
    "Development database setup failed; no credentials or SQL are logged.",
  );
  if (error && typeof error === "object" && "code" in error)
    console.error(`Code: ${String(error.code).replace(/[^A-Z0-9_]/gi, "")}`);
  process.exitCode = 1;
});
