import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { assertDevelopmentTarget } from "../../src/server/db/target";
loadEnvConfig(process.cwd());
async function run() {
  const changes: Record<string,string> = {};
  for (const test of [false,true]) {
    const direct = process.env[test ? "TEST_DIRECT_DATABASE_URL" : "DIRECT_DATABASE_URL"];
    const target = assertDevelopmentTarget(direct,test,true);
    const role = test ? "pusula_test_auth" : "pusula_auth";
    const key = test ? "TEST_AUTH_DATABASE_URL" : "AUTH_DATABASE_URL";
    const admin = new Client({connectionString:direct,connectionTimeoutMillis:10000});
    await admin.connect();
    try {
      const exists = await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1",[role]);
      let password: string;
      if (exists.rowCount) {
        const saved = process.env[key];
        if (!saved || new URL(saved).username !== role) throw new Error("Existing auth role requires local credentials");
        password = decodeURIComponent(new URL(saved).password);
      } else {
        password = randomBytes(32).toString("hex");
        await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
      }
      await admin.query(`GRANT CONNECT ON DATABASE "${target.pathname.slice(1)}" TO "${role}"`);
      await admin.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON "AuthUser","AuthSession","AuthAccount","AuthVerification","AuthRateLimit" TO "${role}"`);
      await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON "AuthTwoFactor" TO "${role}"`);
      await admin.query(`GRANT SELECT ON "AuthBootstrap" TO "${role}"`);
      await admin.query(`GRANT SELECT,INSERT ON "AuthSecurityEvent" TO "${role}"`);
      await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON "AuthInvitation" TO "${role}"`);
      const pooled = new URL(process.env[test ? "TEST_DATABASE_URL" : "DATABASE_URL"]!);
      pooled.username = role; pooled.password = password; changes[key] = pooled.toString();
      console.log(`Auth role verified: ${test ? "test" : "development"}`);
    } finally { await admin.end(); }
  }
  if (!process.env.AUTH_SECRET) changes.AUTH_SECRET = randomBytes(48).toString("base64url");
  if (!process.env.AUTH_TEST_SECRET) changes.AUTH_TEST_SECRET = randomBytes(48).toString("base64url");
  let env = await readFile(".env.local","utf8");
  for (const [key,value] of Object.entries(changes)) {
    const line = `${key}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${key}=.*$`,"m");
    env = pattern.test(env) ? env.replace(pattern,()=>line) : `${env.trimEnd()}\n${line}\n`;
  }
  await writeFile(".env.local",env,{encoding:"utf8",mode:0o600});
  console.log("Auth environment merged without displaying credentials.");
}
run().catch(()=>{console.error("Auth role setup failed; sensitive details suppressed.");process.exitCode=1;});
