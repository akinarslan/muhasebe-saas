import { NextResponse } from "next/server";


import { latestRate } from "@/lib/tcmb";
import { readRateStore, writeRateStore } from "@/lib/rate-store";
import type { RateSnapshot } from "@/lib/pricing-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const manualEnabled = () => false;
export async function GET() {
  let cached: RateSnapshot | null = null;
  try {
    cached = (await readRateStore()).tcmb;
  } catch {
    return json(
      { rate: null, stale: true, error: "Sunucudaki kur kaydı okunamadı." },
      503,
    );
  }
  if (
    cached?.eurValue &&
    Date.now() - new Date(cached.fetchedAt).getTime() < 300000
  )
    return json({
      rate: cached,
      stale: false,
      manualEnabled: manualEnabled(),
      cached: true,
    });
  const result = await latestRate(cached);
  if (result.rate && !result.stale)
    try {
      await writeRateStore(result.rate);
    } catch {
      return json({
        ...result,
        stale: true,
        error:
          "Kur alındı ancak sunucu yedeği yazılamadı; kalıcılık garanti edilemiyor.",
        manualEnabled: manualEnabled(),
      });
    }
  return json(
    { ...result, manualEnabled: manualEnabled() },
    result.rate ? 200 : 503,
  );
}

export async function POST() {
  return json({error:"Manuel kur yalnız doğrulanmış bulut oturumu ve yetkilerle /api/cloud/exchange-rate üzerinden kaydedilebilir."},403);
}
