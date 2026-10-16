import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { masterFixture } from "./master-fixture";
import { contextFor,scoped,authorize } from "../../src/server/authorization/context";
import { listUsers,changeUser,protectLastMaster,revokeUserSessions } from "../../src/server/authorization/users";
import { inviteUser,acceptInvitation } from "../../src/server/auth/invitations";
import { authRequest,activeSession } from "../../src/server/auth/core";
let passed=0;
async function check(name:string,fn:()=>Promise<void>){await fn();console.log(`PASS ${++passed}: ${name}`);}
async function run(){
 const f=await masterFixture();
 try{
 const context=await contextFor(f.headers(),f.db,f.source);
 const email=`invite-${randomBytes(10).toString("hex")}@example.invalid`,password=randomBytes(24).toString("base64url");let targetId="",token="",version=1;
 await check("session-backed membership and tenant-wide master permissions",async()=>{
  assert(context.isMaster);authorize(context,"users.roles",{tenantId:context.tenantId});
  const fake=f.headers();fake.set("x-pusula-membership","00000000-0000-4000-8000-000000000000");await assert.rejects(contextFor(fake,f.db,f.source));
 });
 await check("real invite, safe test carrier, single-use acceptance",async()=>{
  const result=await inviteUser(f.headers(),{name:"C3 invited fixture",email},f.db,f.source);assert.equal(result.delivery,"local_test_carrier");targetId=result.membershipId!;
  token=new URL(f.messages.at(-1)!.url).searchParams.get("token")!;
  assert.equal((await f.source.db.authInvitation.findFirstOrThrow({where:{membershipId:targetId}})).tokenHash.includes(token),false);
  await acceptInvitation({token,password},f.db,f.source);await assert.rejects(acceptInvitation({token,password},f.db,f.source));
  version=(await scoped(context,tx=>tx.membership.findUniqueOrThrow({where:{id:targetId}}),f.db)).version;
 });
 const company=(await f.source.db.authBootstrap.findFirstOrThrow()).legalEntityId;
 const input={version,status:"ACTIVE" as const,roleId:"SALES" as const,scope:{kind:"LEGAL_ENTITY" as const,legalEntityId:company,activityId:null},overrides:[{permissionId:"materials.costView",effect:"ALLOW" as const}]};
 await check("role and scoped override are persisted with audit",async()=>{
  const result=await changeUser(f.headers(),targetId,input,f.db,f.source);version=result.version;
  const list=await listUsers(f.headers(),f.db,f.source);const member=list.members.find(m=>m.id===targetId)!;assert.equal(member.roles[0].roleId,"SALES");assert.equal(member.overrides[0].effect,"ALLOW");
  assert(await scoped(context,tx=>tx.auditEvent.count({where:{targetId,action:"USER_ACCESS_CHANGED"}}),f.db)>0);
 });
 let cookie="";
 await check("login follows current overrides; removal has immediate effect",async()=>{
  const r=await authRequest(new Request("http://127.0.0.1:3000/api/auth/sign-in/email",{method:"POST",headers:{"Content-Type":"application/json",Origin:"http://127.0.0.1:3000"},body:JSON.stringify({email,password})}),f.source);
  assert.equal(r.status,200);cookie=r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");const h=new Headers({cookie});
  const allowed=await contextFor(h,f.db,f.source);authorize(allowed,"materials.costView",{tenantId:context.tenantId,legalEntityId:company});
  const result=await changeUser(f.headers(),targetId,{...input,version,overrides:[{permissionId:"materials.costView",effect:"DENY"}]},f.db,f.source);version=result.version;
  const denied=await contextFor(h,f.db,f.source);assert.throws(()=>authorize(denied,"materials.costView",{tenantId:context.tenantId,legalEntityId:company}));
  assert.throws(()=>authorize(denied,"customers.view",{tenantId:context.tenantId,legalEntityId:"other"}));
 });
 await check("self elevation and stale update rejected",async()=>{
  await assert.rejects(changeUser(f.headers(),context.membershipId,{...input,version:1},f.db,f.source));
  await assert.rejects(changeUser(f.headers(),targetId,{...input,version:1},f.db,f.source));
 });
 await check("last active master protected inside serialized transaction",async()=>{
  await assert.rejects(scoped(context,tx=>protectLastMaster(tx,context.tenantId,context.membershipId,false,"INACTIVE"),f.db));
 });
 await check("session revoke and deactivation remove real access",async()=>{
  await revokeUserSessions(f.headers(),targetId,f.db,f.source);assert.equal(await activeSession(new Headers({cookie}),f.source),null);
  await changeUser(f.headers(),targetId,{...input,version,status:"INACTIVE",overrides:[]},f.db,f.source);
  await assert.rejects(contextFor(new Headers({cookie}),f.db,f.source));
 });
 await check("RLS hides other tenant membership and audit; runtime audit is immutable",async()=>{
  const outsider={userId:context.userId,tenantId:"00000000-0000-4000-8000-000000000000"};
  assert.equal(await scoped(outsider,tx=>tx.auditEvent.count(),f.db),0);
  assert.equal(await scoped(outsider,tx=>tx.membership.count({where:{id:targetId}}),f.db),0);
  await assert.rejects(scoped(context,tx=>tx.auditEvent.deleteMany({where:{targetId}}),f.db));
 });
 }finally{await f.close();}
}
run().catch((e)=>{console.error("Diagnostic",e?.name,e?.code,e?.reason);console.error(`C3 failed after ${passed} checks; sensitive details suppressed.`);process.exitCode=1;});
