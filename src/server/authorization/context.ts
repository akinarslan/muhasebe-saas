import "server-only";
import type { PrismaClient,Prisma } from "@/generated/prisma/client";
import { database } from "@/server/db/client";
import { activeSession,identity } from "@/server/auth/core";
import { requireMfa } from "@/server/auth/mfa";
import { decide } from "@/lib/auth/policy";
import type { Grant,Resource } from "@/lib/auth/catalog";
export class AccessError extends Error { constructor(public status:number,public reason:string){super(reason);} }
export type Context={userId:string;sessionId:string;membershipId:string;tenantId:string;isMaster:boolean;grants:Grant[]};
export async function scoped<T>(context:Pick<Context,"userId"|"tenantId">,operation:(tx:Prisma.TransactionClient)=>Promise<T>,db:PrismaClient=database(),entityId?:string){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT set_config('app.user_id',${context.userId},true),set_config('app.tenant_id',${context.tenantId},true),set_config('app.legal_entity_id',${entityId??""},true)`;
  return operation(tx);
 },{maxWait:8000,timeout:15000});
}
export async function contextFor(headers:Headers,db=database(),source=identity()):Promise<Context>{
 const session=await activeSession(headers,source);if(!session)throw new AccessError(401,"UNAUTHENTICATED");
 const member=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT set_config('app.user_id',${session.user.id},true)`;
  const requested=headers.get("x-pusula-membership");
  return tx.membership.findFirst({where:{userId:session.user.id,status:"ACTIVE",...(requested?{id:requested}:{})},orderBy:{createdAt:"asc"}});
 });
 if(!member)throw new AccessError(403,"MEMBERSHIP_REQUIRED");
 const context={userId:session.user.id,sessionId:session.session.id,membershipId:member.id,tenantId:member.tenantId,isMaster:member.isMaster,grants:[] as Grant[]};
 if(member.isMaster){try{await requireMfa(headers,false,source);}catch{throw new AccessError(403,"MFA_REQUIRED");}}
 context.grants=await scoped(context,async tx=>{
  const current=await tx.membership.findUnique({where:{id:member.id},include:{roles:{include:{scope:true,role:{include:{permissions:true}}}},overrides:{include:{scope:true}}}});
  if(!current||current.status!=="ACTIVE")throw new AccessError(403,"MEMBERSHIP_REQUIRED");
  return [...current.roles.flatMap(r=>r.role.permissions.map(p=>({permissionId:p.permissionId,effect:"ALLOW" as const,source:"ROLE" as const,scope:{...r.scope,amountLimit:r.scope.amountLimit?.toString()??null}}))),
   ...current.overrides.map(o=>({permissionId:o.permissionId,effect:o.effect,source:"OVERRIDE" as const,scope:{...o.scope,amountLimit:o.scope.amountLimit?.toString()??null}}))];
 },db);
 return context;
}
export function authorize(context:Context,action:string,resource:Resource){
 if(!decide(context.userId,action,resource,context.grants))throw new AccessError(403,"FORBIDDEN");
}
export async function requireStepUp(headers:Headers,source=identity()){
 try{await requireMfa(headers,true,source);}catch{throw new AccessError(403,"STEP_UP_REQUIRED");}
}
