import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { latestRate } from "@/lib/tcmb";
import { readRateStore, writeRateStore } from "@/lib/rate-store";
import type { RateSnapshot } from "@/lib/pricing-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const manualEnabled = () =>
  Boolean(
    process.env.PUSULA_RATE_ADMIN_TOKEN &&
    process.env.PUSULA_RATE_ADMIN_TOKEN.length >= 24,
  );
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
const manualSchema = z.object({
  value: z.number().positive().max(1000000),
  reason: z.string().trim().min(5).max(500),
});
export async function POST(request: Request) {
  if (!manualEnabled())
    return json(
      { error: "Yetkili manuel kur girişi bu sunucuda yapılandırılmadı." },
      503,
    );
  const expected = Buffer.from(process.env.PUSULA_RATE_ADMIN_TOKEN!);
  const supplied = Buffer.from(
    request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "",
  );
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return json({ error: "Yönetici anahtarı geçersiz." }, 403);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "İstek kaynağı geçersiz." }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek." }, 400);
  }
  const parsed = manualSchema.safeParse(body);
  if (!parsed.success)
    return json(
      { error: "Pozitif bir kur ve en az 5 karakter açıklama girin." },
      400,
    );
  const now = new Date();
  const rate: RateSnapshot = {
    value: parsed.data.value,
    source: "manual",
    publishedAt: new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Istanbul",
    }).format(now),
    fetchedAt: now.toISOString(),
    authorizedBy: process.env.PUSULA_RATE_ADMIN_NAME || "Yerel yönetici",
    reason: parsed.data.reason,
  };
  try {
    await writeRateStore(rate);
  } catch {
    return json(
      { error: "Manuel kur denetim kaydı yazılamadı. İşlem yapılmadı." },
      503,
    );
  }
  return json({ rate, stale: false });
}
