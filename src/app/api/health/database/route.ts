import { NextResponse } from "next/server";
import { databaseHealth } from "@/server/db/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const healthy = await databaseHealth();
  return NextResponse.json(
    { status: healthy ? "ok" : "unavailable" },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
