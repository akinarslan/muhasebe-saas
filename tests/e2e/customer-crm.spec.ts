import { test, expect } from "@playwright/test";
import { createDemo } from "../../src/lib/mock";

test("CRM yeni müşteri aç, doğrula, kaydet ve yenile", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", r => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const oldData = createDemo();
  // Legacy fields deliberately invalid: production migration must repair them.
  await page.addInitScript(data => {
    if (!localStorage.getItem("pusula.demo.v1")) {
      const legacy = data.customers[0] as unknown as Record<string, unknown>;
      legacy.name = null;
      legacy.email = null;
      localStorage.setItem("pusula.demo.v1", JSON.stringify(data));
    }
  }, oldData);
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1280) < 540) {
    await page.getByRole("button", { name: "Menüyü aç" }).click();
  }
  await page.getByRole("navigation").getByRole("button", { name: "Müşteriler ve Cari", exact: true }).click();
  await page.getByRole("button", { name: "Yeni müşteri", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Müşteriyi kaydet" }).click();
  await expect(dialog.getByText("En az 2 karakter girin.")).toBeVisible();
  await dialog.getByLabel(/Şirket \/ kurum adı/).fill("CRM Test Atölyesi");
  await dialog.locator('select[name="city"]').selectOption("İstanbul");
  await dialog.locator('select[name="district"]').selectOption("Kadıköy");
  await dialog.locator('select[name="city"]').selectOption("Ankara");
  await expect(dialog.locator('select[name="district"]')).toHaveValue("");
  await dialog.getByRole("button", { name: "Müşteriyi kaydet" }).click();
  await expect(page.getByRole("dialog", { name: "CRM Test Atölyesi" })).toBeVisible();
  await page.getByRole("button", { name: "Müşteri detayını kapat" }).click();
  await page.getByLabel("Müşteri adına göre ara").fill("CRM Test Atölyesi");
  await expect(page.getByRole("button", { name: "CRM Test Atölyesi detayları" })).toBeVisible();
  await page.getByRole("button", { name: "Yeni müşteri", exact: true }).click();
  await dialog.getByLabel(/Şirket \/ kurum adı/).fill("CRM Test Atölyesi");
  await dialog.getByRole("button", { name: "Müşteriyi kaydet" }).click();
  await expect(dialog.getByText(/bir müşteri zaten var/)).toBeVisible();
  await dialog.getByLabel(/Şirket \/ kurum adı/).fill("Başka müşteri");
  await dialog.getByText("Vergi ve diğer bilgiler").click();
  await dialog.getByLabel("VKN / TCKN").fill("123");
  await dialog.getByRole("button", { name: "Müşteriyi kaydet" }).click();
  await expect(dialog.getByText("VKN 10, TCKN 11 rakam olmalıdır.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pusula.demo.v1")!).customers.some((c: {name:string}) => c.name === "CRM Test Atölyesi"))).toBe(true);
  await info.attach("browser-errors", { body: JSON.stringify(errors), contentType: "application/json" });
  expect(errors).toEqual([]);
});

test("boş satıştan yeni müşteri gereksiz onay olmadan seçilir", async ({ page }) => {
  await page.route("**/api/exchange-rate", r => r.fulfill({ json: { rate: null, stale: true } }));
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1280) < 540) await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Satışlar", exact: true }).click();
  await page.getByRole("button", { name: "Yeni müşteri", exact: true }).click();
  await page.getByLabel(/Şirket \/ kurum adı/).fill("Boş form müşterisi");
  await page.getByRole("button", { name: "Müşteriyi kaydet" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Müşteri seçin").locator("option:checked")).toContainText("Boş form müşterisi");
});

test("satış müşterisi onay, Escape, segment, tahsilat ve geçmiş kayıt sınırı", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/exchange-rate", r => r.fulfill({ json: { rate: { value: 50, source: "tcmb", publishedAt: "2026-10-16", fetchedAt: "2026-10-16T08:00:00Z" }, stale: false } }));
  await page.addInitScript(data => { if (!localStorage.getItem("pusula.demo.v1")) localStorage.setItem("pusula.demo.v1", JSON.stringify(data)); }, createDemo());
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1280) < 540) await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Satışlar", exact: true }).click();
  const select = page.getByLabel("Müşteri seçin");
  const ids = await select.locator("option").evaluateAll(options => options.map(o => (o as HTMLOptionElement).value).filter(Boolean));
  await select.selectOption(ids[0]);
  await page.getByRole("button", { name: "Dijital baskı folyo", exact: true }).click();
  await page.getByRole("button", { name: "Maliyet ve fiyat hesapla" }).click();
  await page.getByRole("button", { name: "Malzeme ekle", exact: true }).click();
  await page.getByRole("button", { name: "Fiyatı ve maliyeti sabitle" }).click();
  await page.getByLabel("Satış notu").fill("Özel müşteri notu");
  await page.getByLabel("Peşin ödenen miktar").fill("20");
  await page.getByRole("button", { name: "Ödeme ekle" }).click();
  const before = await page.evaluate(() => localStorage.getItem("pusula.draft.v1"));
  await select.selectOption(ids[1]);
  const confirm = page.getByRole("dialog", { name: "Müşteri değiştirilsin mi?" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await confirm.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
  await page.screenshot({ path: `test-results/${info.project.name}-customer-switch.png` });
  expect(await page.evaluate(() => localStorage.getItem("pusula.draft.v1"))).toBe(before);
  await page.keyboard.press("Escape");
  await expect(select).toHaveValue(ids[0]);
  expect(await page.evaluate(() => localStorage.getItem("pusula.draft.v1"))).toBe(before);
  await page.getByLabel("Müşteri segmenti").selectOption("Reklamcı");
  await confirm.getByRole("button", { name: "Vazgeç" }).click();
  expect(await page.evaluate(() => localStorage.getItem("pusula.draft.v1"))).toBe(before);
  // Existing persisted historical records are outside the active draft transaction.
  const history = await page.evaluate(() => localStorage.getItem("pusula.demo.v1"));
  expect(JSON.parse(history!).sales).toHaveLength(84);
  await select.selectOption(ids[1]);
  await confirm.getByRole("button", { name: "Devam et ve temizle" }).click();
  await expect(select).toHaveValue(ids[1]);
  const next = await page.evaluate(() => JSON.parse(localStorage.getItem("pusula.draft.v1")!));
  expect(next).toMatchObject({ lines: [], plans: [], notes: "", paid: 0 });
  expect(next.rateSnapshot).toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem("pusula.demo.v1"))).toBe(history);
  expect(errors).toEqual([]);
});
