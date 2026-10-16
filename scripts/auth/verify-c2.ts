import assert from "node:assert/strict";
import { createOTP } from "@better-auth/utils/otp";
import { symmetricDecrypt } from "better-auth/crypto";
import { authFixture } from "./fixture";
import { bootstrap } from "../../src/server/auth/bootstrap";
import { createAuth,authRequest,activeSession } from "../../src/server/auth/core";
import { requireMfa } from "../../src/server/auth/mfa";
let passed=0;
async function check(name:string,fn:()=>Promise<void>){await fn();console.log(`PASS ${++passed}: ${name}`);}
async function run(){
  const fixture=await authFixture();
  const source=createAuth(process.env.TEST_AUTH_DATABASE_URL!,process.env.AUTH_TEST_SECRET!,true);
  const cookies=new Map<string,string>();
  const headers=()=>new Headers({"Content-Type":"application/json",Origin:"http://127.0.0.1:3000",cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")});
  async function call(path:string,body:object){
    const response=await authRequest(new Request(`http://127.0.0.1:3000/api/auth${path}`,{method:"POST",headers:headers(),body:JSON.stringify(body)}),source);
    for(const cookie of response.headers.getSetCookie()){const part=cookie.split(";")[0],i=part.indexOf("=");cookies.set(part.slice(0,i),part.slice(i+1));}
    return response;
  }
  try{
    await source.db.authRateLimit.deleteMany();
    await check("bootstrap is closed and idempotent",async()=>{
      const result=await bootstrap({...fixture,name:"Ignored",tenantName:"Ignored",companyName:"Ignored"},true);assert.equal(result.created,false);
      assert.equal(await source.db.authBootstrap.count(),1);
    });
    await call("/sign-in/email",fixture);
    const user=await source.db.authUser.findUniqueOrThrow({where:{email:fixture.email}});
    let recovery:string[]=[];
    if(!user.twoFactorEnabled){
      await check("master cannot administer without MFA",async()=>{await assert.rejects(requireMfa(headers(),false,source));});
      await check("TOTP enrollment returns one-time recovery and encrypted storage",async()=>{
        const response=await call("/two-factor/enable",{password:fixture.password});assert.equal(response.status,200);
        const body=await response.json();assert(body.totpURI.startsWith("otpauth://"));recovery=body.backupCodes;
        const stored=await source.db.authTwoFactor.findUniqueOrThrow({where:{userId:user.id}});
        assert(!stored.secret.includes(new URL(body.totpURI).searchParams.get("secret")!));
        assert(!recovery.some(code=>stored.backupCodes.includes(code)));
      });
    }
    const stored=await source.db.authTwoFactor.findUniqueOrThrow({where:{userId:user.id}});
    const secret=await symmetricDecrypt({key:process.env.AUTH_TEST_SECRET!,data:stored.secret});
    await check("invalid second factor rejected",async()=>{assert.notEqual((await call("/two-factor/verify-totp",{code:"invalid"})).status,200);});
    await check("real TOTP verification enables protected session",async()=>{
      assert.equal((await call("/two-factor/verify-totp",{code:await createOTP(secret).totp()})).status,200);
      assert.equal((await requireMfa(headers(),false,source)).user.id,user.id);
      await assert.rejects(requireMfa(headers(),true,source));
    });
    await check("critical step-up requires password plus TOTP",async()=>{
      assert.equal((await call("/step-up",{password:"wrong",code:await createOTP(secret).totp()})).status,403);
      assert.equal((await call("/step-up",{password:fixture.password,code:await createOTP(secret).totp()})).status,200);
      await requireMfa(headers(),true,source);
    });
    await check("trusted devices and backup re-display disabled",async()=>{
      assert.equal((await call("/two-factor/verify-totp",{code:"123456",trustDevice:true})).status,400);
      assert.equal((await call("/two-factor/view-backup-codes",{userId:user.id})).status,404);
      assert.equal((await call("/two-factor/disable",{password:fixture.password})).status,404);
    });
    if(!recovery.length)recovery=JSON.parse(await symmetricDecrypt({key:process.env.AUTH_TEST_SECRET!,data:stored.backupCodes}));
    await check("recovery code can only be consumed once",async()=>{
      await call("/sign-out",{});await call("/sign-in/email",fixture);
      assert.equal(await activeSession(headers(),source),null);
      assert.equal((await call("/two-factor/verify-backup-code",{code:recovery[0]})).status,200);
      assert.notEqual((await call("/two-factor/verify-backup-code",{code:recovery[0]})).status,200);
    });
    await check("security audit append-only",async()=>{
      assert(await source.db.authSecurityEvent.count({where:{userId:user.id}})>0);
      await assert.rejects(source.db.authSecurityEvent.deleteMany({where:{userId:user.id}}));
    });
  }finally{await source.db.$disconnect();}
}
run().catch(()=>{console.error(`C2 failed after ${passed} checks; sensitive errors suppressed.`);process.exitCode=1;});
