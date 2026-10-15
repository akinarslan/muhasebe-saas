import type { RateSnapshot } from "./pricing-types";
export const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";
export function parseTcmb(
  xml: string,
  fetchedAt = new Date().toISOString(),
): RateSnapshot {
  const date = xml.match(
    /<Tarih_Date\b[^>]*\bTarih="(\d{2})\.(\d{2})\.(\d{4})"/,
  );
  const usd = xml.match(
    /<Currency\b[^>]*(?:Kod|CurrencyCode)="USD"[^>]*>([\s\S]*?)<\/Currency>/,
  )?.[1];
  if (!date || !usd)
    throw new Error("TCMB yanıtında USD veya yayın tarihi bulunamadı.");
  const selling = usd.match(
    /<ForexSelling>\s*([\d.,]+)\s*<\/ForexSelling>/,
  )?.[1];
  const unit = Number(usd.match(/<Unit>\s*(\d+)\s*<\/Unit>/)?.[1] ?? 1);
  const value = Number(selling?.replace(",", ".")) / unit;
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isFinite(unit) ||
    unit <= 0
  )
    throw new Error("TCMB USD döviz satış kuru geçersiz.");
  const publishedAt = `${date[3]}-${date[2]}-${date[1]}`;
  if (
    new Date(publishedAt + "T12:00:00Z").toISOString().slice(0, 10) !==
    publishedAt
  )
    throw new Error("TCMB tarihi geçersiz.");
  const eur = xml.match(
    /<Currency\b[^>]*(?:Kod|CurrencyCode)="EUR"[^>]*>([\s\S]*?)<\/Currency>/,
  )?.[1];
  const eurValue = eur
    ? Number(
        eur
          .match(/<ForexSelling>\s*([\d.,]+)\s*<\/ForexSelling>/)?.[1]
          ?.replace(",", "."),
      ) / Number(eur.match(/<Unit>\s*(\d+)\s*<\/Unit>/)?.[1] ?? 1)
    : undefined;
  if (eurValue !== undefined && (!Number.isFinite(eurValue) || eurValue <= 0))
    throw new Error("TCMB EUR kuru geçersiz.");
  return {
    value,
    source: "tcmb",
    publishedAt,
    fetchedAt,
    ...(eurValue ? { eurValue } : {}),
  };
}
export async function fetchTcmb(
  fetcher: typeof fetch = fetch,
): Promise<RateSnapshot> {
  const response = await fetcher(TCMB_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/xml" },
  });
  if (!response.ok) throw new Error("TCMB servisi yanıt vermedi.");
  return parseTcmb(await response.text());
}
export async function latestRate(
  cached: RateSnapshot | null,
  fetcher: typeof fetch = fetch,
) {
  try {
    return { rate: await fetchTcmb(fetcher), stale: false };
  } catch {
    return {
      rate: cached,
      stale: true,
      error: cached
        ? "TCMB erişilemedi. Son başarılı kur kullanılıyor; eski olabilir."
        : "TCMB erişilemedi ve kayıtlı başarılı kur yok. Fiyat kaydı için tekrar deneyin veya yetkili manuel kur girin.",
    };
  }
}
