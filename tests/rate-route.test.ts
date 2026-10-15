// @vitest-environment node
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const { store, write } = vi.hoisted(() => ({
  store: { tcmb: null as unknown },
  write: vi.fn(),
}));
vi.mock("../src/lib/rate-store", () => ({
  readRateStore: async () => store,
  writeRateStore: write,
}));
import { GET, POST } from "../src/app/api/exchange-rate/route";
const token = "test-only-admin-token-123456789";
const request = (body: unknown, key = token) =>
  new Request("http://localhost:3000/api/exchange-rate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  write.mockReset();
  store.tcmb = null;
  vi.stubEnv("PUSULA_RATE_ADMIN_TOKEN", token);
  vi.stubEnv("PUSULA_RATE_ADMIN_NAME", "Test yönetici");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Yetkili kur endpoint’i", () => {
  it("yetkisiz manuel kuru reddeder ve denetim kaydı oluşturmaz", async () => {
    expect(
      (await POST(request({ value: 51, reason: "Test açıklaması" }, "wrong")))
        .status,
    ).toBe(403);
    expect(write).not.toHaveBeenCalled();
  });
  it("manuel kur, tarih, yetkili ve gerekçeyi saklar", async () => {
    const response = await POST(
      request({ value: 51.2, reason: "Tedarikçi anlaşma kuru" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.rate).toMatchObject({
      value: 51.2,
      source: "manual",
      authorizedBy: "Test yönetici",
      reason: "Tedarikçi anlaşma kuru",
    });
    expect(write).toHaveBeenCalledWith(body.rate);
  });
  it("geçersiz kur veya açıklamayı reddeder", async () => {
    expect((await POST(request({ value: 0, reason: "x" }))).status).toBe(400);
    expect(write).not.toHaveBeenCalled();
  });
  it("yönetici anahtarı yapılandırılmadıysa manuel seçeneği kapatır", async () => {
    vi.stubEnv("PUSULA_RATE_ADMIN_TOKEN", "");
    expect(
      (await POST(request({ value: 51, reason: "Test açıklaması" }))).status,
    ).toBe(503);
  });
  it("TCMB ve önbellek yoksa 503 döner, örnek kur vermez", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const r = await GET();
    expect(r.status).toBe(503);
    expect((await r.json()).rate).toBeNull();
  });
  it("diskteki son başarılı kuru hizmet hatasında korur", async () => {
    store.tcmb = {
      value: 49,
      source: "tcmb",
      publishedAt: "2026-10-14",
      fetchedAt: "2026-10-14T13:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.rate).toEqual(store.tcmb);
    expect(body.stale).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it("kur diske yazılamazsa manuel başarı bildirmez", async () => {
    write.mockRejectedValueOnce(new Error("disk"));
    expect(
      (await POST(request({ value: 51, reason: "Test açıklaması" }))).status,
    ).toBe(503);
  });
});
