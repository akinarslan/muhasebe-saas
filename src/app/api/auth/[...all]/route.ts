import { authRequest } from "@/server/auth/core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try { return await authRequest(request); }
  catch { return Response.json({ error: "Kimlik hizmetine erişilemiyor." }, { status: 503 }); }
}
export { handle as GET, handle as POST };
