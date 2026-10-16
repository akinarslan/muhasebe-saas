import { cloudRequest } from "@/server/cloud/handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:Request){try{return await cloudRequest(request);}catch{return Response.json({error:"SERVICE_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});}}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
