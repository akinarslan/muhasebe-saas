import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { bootstrap } from "../../src/server/auth/bootstrap";
loadEnvConfig(process.cwd());
async function run(){
  const env=parseEnv(await readFile(".env.bootstrap.local","utf8"));
  const result=await bootstrap({email:env.BOOTSTRAP_EMAIL,name:env.BOOTSTRAP_NAME,password:env.BOOTSTRAP_PASSWORD,
    tenantName:env.BOOTSTRAP_TENANT_NAME,companyName:env.BOOTSTRAP_COMPANY_NAME});
  console.log(result.created?"First Master created. MFA enrollment is required before administration.":"Bootstrap is already closed; no account was changed.");
}
run().catch(()=>{console.error("Bootstrap unavailable. Check the private local setup file; sensitive errors are suppressed.");process.exitCode=1;});
