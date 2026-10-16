import { test, expect, type Page } from "@playwright/test";

async function nav(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1280) < 540) await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("navigation").getByRole("button", { name, exact: true }).click();
}
test("elle USD fiyatı katalogdan hesaba geçer; kur ve geçmiş snapshot ayrıdır", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  let value = 50;
  await page.route("**/api/exchange-rate", r => r.fulfill({ json: { rate: { value, source: "tcmb", publishedAt: "2026-10-16", fetchedAt: "2026-10-16T08:00:00Z" }, stale: false } }));
  await page.goto("/");
  await nav(page, "Malzeme Yönetimi");
  const input = page.getByLabel(/Vinil.*USD maliyeti/).first();
  await input.fill("2.5");
  await input.locator("xpath=ancestor::form").getByRole("button", { name: "Maliyeti güncelle" }).click();
  const catalog = await page.evaluate(() => JSON.parse(localStorage.getItem("pusula.pricing.v2")!));
  const vinil = catalog.materials.find((m: {id:string}) => m.id === "seed-vinil");
  expect(vinil.variants[0].usdCost).toBe(2.5);
  expect(vinil.variants[0].history.at(-1)).toMatchObject({ previous: 1.2, next: 2.5 });
  await nav(page, "Teklif ve Maliyet");
  await page.getByRole("button", { name: "Malzeme ekle", exact: true }).click();
  await expect(page.getByText("2.5000 USD / m²", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fiyatı ve maliyeti sabitle" }).click();
  const first = await page.evaluate(() => JSON.parse(localStorage.getItem("pusula.quotes.v2")!)[0]);
  expect(first.snapshot.materialCostUsd).toBeCloseTo(7.14, 8);
  value = 60;
  await page.getByRole("button", { name: "TCMB kurunu yenile" }).click();
  await expect(page.locator(".rate-panel")).toContainText("60");
  await page.getByRole("button", { name: "Maliyet hesaplayıcı", exact: true }).click();
  await page.getByRole("button", { name: "Malzeme ekle", exact: true }).click();
  await page.getByRole("button", { name: "Fiyatı ve maliyeti sabitle" }).click();
  const quotes = await page.evaluate(() => JSON.parse(localStorage.getItem("pusula.quotes.v2")!));
  expect(quotes[0]).toEqual(first);
  expect(quotes[1].snapshot.rate.value).toBe(60);
  expect(quotes[1].snapshot.materialCostUsd).toBeCloseTo(7.14, 8);
  expect(quotes[1].snapshot.chosenNetUsd * quotes[1].snapshot.rate.value).toBeCloseTo(first.snapshot.chosenNetUsd * first.snapshot.rate.value * 1.2, 6);
  expect(await page.evaluate(() => localStorage.getItem("pusula.pricing.v2"))).toBe(JSON.stringify(catalog));
  expect(errors).toEqual([]);
});
