// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { parseTcmb, latestRate, fetchTcmb } from "../src/lib/tcmb";
const xml =
  '<Tarih_Date Tarih="15.10.2026"><Currency Kod="USD" CurrencyCode="USD"><Unit>1</Unit><ForexBuying>48.01</ForexBuying><ForexSelling>49.4204</ForexSelling><BanknoteSelling>50.99</BanknoteSelling></Currency></Tarih_Date>';
describe("TCMB sunucu kur hizmeti", () => {
  it("USD döviz satışını alır; efektif satış veya alış kuruyla karıştırmaz", () => {
    expect(parseTcmb(xml, "2026-10-15T14:00:00Z")).toEqual({
      value: 49.4204,
      source: "tcmb",
      publishedAt: "2026-10-15",
      fetchedAt: "2026-10-15T14:00:00Z",
    });
  });
  it("bozuk, eksik ve sıfır kuru reddeder", () => {
    for (const text of [
      "",
      xml.replace("USD", "EUR").replace("USD", "EUR"),
      xml.replace("49.4204", "0"),
    ])
      expect(() => parseTcmb(text)).toThrow();
  });
  it("sabit TCMB adresini sunucudan no-store ile ister", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(xml));
    const r = await fetchTcmb(fetcher);
    expect(r.value).toBe(49.4204);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://www.tcmb.gov.tr/kurlar/today.xml",
    );
    expect(fetcher.mock.calls[0][1].cache).toBe("no-store");
  });
  it("servis hatasında son başarılı kuru ve eski uyarısını korur", async () => {
    const previous = parseTcmb(xml, "2026-10-15T12:00:00Z");
    const result = await latestRate(
      previous,
      vi.fn().mockRejectedValue(new Error("network")),
    );
    expect(result.rate).toEqual(previous);
    expect(result.stale).toBe(true);
    expect(result.error).toContain("Son başarılı");
  });
  it("ilk başarısız istekte kur uydurmaz", async () => {
    const r = await latestRate(
      null,
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    expect(r.rate).toBeNull();
    expect(r.stale).toBe(true);
  });
  it("yeni yayını yeni hesaplar için döndürür", async () => {
    const old = parseTcmb(xml);
    const next = await latestRate(
      old,
      vi.fn().mockResolvedValue(new Response(xml.replace("49.4204", "50.5"))),
    );
    expect(next.rate?.value).toBe(50.5);
    expect(old.value).toBe(49.4204);
    expect(next.stale).toBe(false);
  });
});
