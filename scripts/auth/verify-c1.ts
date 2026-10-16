import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createAuth, provisionIdentity, activeSession, authRequest } from "../../src/server/auth/core";
loadEnvConfig(process.cwd());
const source = createAuth(process.env.TEST_AUTH_DATABASE_URL!, process.env.AUTH_TEST_SECRET!, true);
const email = `c1-${randomBytes(10).toString("hex")}@example.invalid`;
const password = randomBytes(24).toString("base64url");
let count = 0;
async function check(name: string, operation: () => Promise<void>) { await operation(); console.log(`PASS ${++count}: ${name}`); }
let cookie = "", userId = "";
async function request(path: string, body?: object) {
  return authRequest(new Request(`http://127.0.0.1:3000/api/auth${path}`, { method: body ? "POST" : "GET",
    headers: { "Content-Type":"application/json", Origin:"http://127.0.0.1:3000", cookie }, body: body ? JSON.stringify(body) : undefined }), source);
}
async function run() {
  await source.db.authRateLimit.deleteMany();
  await check("public signup and server provisioning bypass denied", async()=>{
    assert.equal((await request("/sign-up/email",{name:"Fixture",email,password})).status,404);
    await assert.rejects(source.auth.api.signUpEmail({body:{name:"Fixture",email,password}}));
  });
  const created = await provisionIdentity(()=>source.auth.api.signUpEmail({body:{name:"C1 synthetic fixture",email,password}}));
  userId=created.user.id;
  await source.db.authSession.deleteMany({where:{userId}});
  await check("wrong password denied",async()=>assert.equal((await request("/sign-in/email",{email,password:password+"!"})).status,401));
  await check("real PostgreSQL login and httpOnly SameSite cookie",async()=>{
    const response=await request("/sign-in/email",{email,password});
    assert.equal(response.status,200);
    const cookies=response.headers.getSetCookie();
    assert(cookies.some(c=>/httponly/i.test(c)&&/samesite=lax/i.test(c)));
    cookie=cookies.map(c=>c.split(";")[0]).join("; ");
    assert.equal((await activeSession(new Headers({cookie}),source))?.user.id,userId);
    const account=await source.db.authAccount.findFirstOrThrow({where:{userId}});
    assert(account.password && !account.password.includes(password));
  });
  await check("logout invalidates session",async()=>{
    assert.equal((await request("/sign-out",{})).status,200);
    assert.equal(await activeSession(new Headers({cookie}),source),null);
  });
  await check("server revocation and expired session rejected",async()=>{
    let r=await request("/sign-in/email",{email,password}); cookie=r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    await source.db.authSession.updateMany({where:{userId},data:{expiresAt:new Date(0)}});
    assert.equal(await activeSession(new Headers({cookie}),source),null);
    r=await request("/sign-in/email",{email,password});cookie=r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    await source.db.authSession.deleteMany({where:{userId}});
    assert.equal(await activeSession(new Headers({cookie}),source),null);
  });
  await check("inactive account rejected including existing session",async()=>{
    await source.db.authRateLimit.deleteMany();
    const r=await request("/sign-in/email",{email,password});cookie=r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    await source.db.authUser.update({where:{id:userId},data:{status:"INACTIVE"}});
    assert.equal(await activeSession(new Headers({cookie}),source),null);
    await assert.rejects(source.auth.api.signInEmail({body:{email,password}}));
  });
  await check("auth SQL role cannot read business data or create tables",async()=>{
    await assert.rejects(source.db.$queryRawUnsafe('SELECT * FROM "Customer"'));
    await assert.rejects(source.db.$executeRawUnsafe('CREATE TABLE auth_must_not_create (id int)'));
    const roles=await source.db.$queryRaw<{elevated:boolean}[]>`SELECT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole) AS elevated FROM pg_roles WHERE rolname=current_user`;
    assert.equal(roles[0].elevated,false);
  });
}
run().catch((error)=>{ console.error("Diagnostic",error?.name,error?.code,error?.body?.code, String(error?.body?.message ?? error?.message ?? "").replaceAll(email,"[fixture]").replaceAll(password,"[redacted]").replace(/postgres[^\s]+/gi,"[connection]").slice(0,200));console.error(`Auth C1 failed after ${count} successful checks; sensitive error suppressed.`);process.exitCode=1;})
.finally(async()=>{if(userId)await source.db.authUser.delete({where:{id:userId}});await source.db.$disconnect();});
