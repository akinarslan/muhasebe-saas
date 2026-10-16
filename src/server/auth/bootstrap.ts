import "server-only";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { assertDevelopmentTarget } from "@/server/db/target";
import { createAuth, provisionIdentity } from "./core";
import { z } from "zod";
const inputSchema = z.object({ email:z.email().transform(v=>v.toLowerCase()), name:z.string().min(1).max(200),
  password:z.string().min(12).max(128), tenantName:z.string().min(1).max(200), companyName:z.string().min(1).max(200) });
export async function bootstrap(input: unknown, test=false) {
  const data=inputSchema.parse(input);
  const direct=process.env[test?"TEST_DIRECT_DATABASE_URL":"DIRECT_DATABASE_URL"];
  assertDevelopmentTarget(direct,test,true);
  const admin=new Client({connectionString:direct,connectionTimeoutMillis:10000});
  const source=createAuth(process.env[test?"TEST_AUTH_DATABASE_URL":"AUTH_DATABASE_URL"]!,process.env[test?"AUTH_TEST_SECRET":"AUTH_SECRET"]!,test);
  await admin.connect();
  let createdId: string|undefined;
  try {
    await admin.query("BEGIN");
    await admin.query("SELECT pg_advisory_xact_lock(72303001)");
    const existing=await admin.query('SELECT "userId" FROM "AuthBootstrap" WHERE id=$1',["initial-master"]);
    if(existing.rowCount) { await admin.query("ROLLBACK"); return {created:false}; }
    // An existing unrelated identity is never silently promoted.
    if(await source.db.authUser.findUnique({where:{email:data.email}})) throw new Error("Bootstrap identity already exists");
    const result=await provisionIdentity(()=>source.auth.api.signUpEmail({body:{name:data.name,email:data.email,password:data.password}}));
    createdId=result.user.id;
    const tenantId=randomUUID(), legalEntityId=randomUUID();
    await admin.query('INSERT INTO "Tenant" (id,name) VALUES ($1,$2)',[tenantId,data.tenantName]);
    await admin.query('INSERT INTO "LegalEntity" (id,"tenantId",name) VALUES ($1,$2,$3)',[legalEntityId,tenantId,data.companyName]);
    await admin.query('INSERT INTO "AuthBootstrap" (id,"userId","tenantId","legalEntityId") VALUES ($1,$2,$3,$4)',["initial-master",createdId,tenantId,legalEntityId]);
    await admin.query('INSERT INTO "AuthSecurityEvent" (id,"userId",action) VALUES ($1,$2,$3)',[randomUUID(),createdId,"MASTER_BOOTSTRAP_MFA_PENDING"]);
    await source.db.authSession.deleteMany({where:{userId:createdId}});
    await admin.query("COMMIT");
    return {created:true};
  } catch {
    await admin.query("ROLLBACK");
    if(createdId) await source.db.authUser.delete({where:{id:createdId}});
    throw new Error("Bootstrap failed; no sensitive details are logged.");
  } finally {await admin.end();await source.db.$disconnect();}
}
