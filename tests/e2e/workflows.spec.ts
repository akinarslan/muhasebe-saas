import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/exchange-rate", (r) =>
    r.fulfill({
      json: {
        rate: {
          value: 49.4204,
          eurValue: 55.411,
          source: "tcmb",
          publishedAt: "2026-10-15",
          fetchedAt: "2026-10-15T12:00:00Z",
        },
        stale: false,
      },
    }),
  );
  await page.goto("/");
  if (
    await page
      .getByRole("button", { name: "Demo çalışma alanını aç" })
      .isVisible()
  )
    await page.getByRole("button", { name: "Demo çalışma alanını aç" }).click();
});
async function nav(page: import("@playwright/test").Page, name: RegExp) {
  const mobile = page.getByRole("button", { name: "Menüyü aç" });
  if ((page.viewportSize()?.width ?? 1280) < 540) {
    await expect(mobile).toBeVisible();
    await mobile.click();
    await expect(page.locator(".sidebar")).toHaveClass(/mobile-open/);
  }
  await page
    .getByRole("navigation", { name: "Ana gezinme" })
    .getByRole("button", { name })
    .click();
}
test("müşteri drawer, güvenli bağlam olmadan ID, taslak ve yenileme", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(() => {
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "structuredClone", {
      value: undefined,
      configurable: true,
    });
  });
  await nav(page, /^Satışlar/);
  await page
    .getByRole("button", { name: "Dijital baskı folyo", exact: true })
    .click();
  await page.getByLabel("En (cm)", { exact: true }).fill("135");
  await page.getByLabel("Boy (cm)", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Yeni müşteri", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d).toBeVisible();
  await d.getByLabel(/Şirket \/ kurum adı/).fill("E2E Atölye");
  await d.getByRole("button", { name: "Müşteriyi kaydet" }).click();
  await expect(page.getByText("Müşteri değiştirilsin mi?")).toBeVisible();
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(d).not.toBeVisible();
  await expect(page.getByLabel("Müşteri seçin")).toContainText("E2E Atölye");
  await page.reload();
  if (
    await page
      .getByRole("button", { name: "Demo çalışma alanını aç" })
      .isVisible()
  )
    await page.getByRole("button", { name: "Demo çalışma alanını aç" }).click();
  await nav(page, /^Satışlar/);
  await expect(page.getByLabel("En (cm)", { exact: true })).toHaveValue("135");
  const customerId = await page.evaluate(() => JSON.parse(localStorage.getItem("pusula.demo.v1")!).customers.at(-1).id);
  await page.getByLabel("Müşteri seçin").selectOption(customerId);
  await page.getByRole("button", { name: "Devam et ve temizle" }).click();
  await expect(page.getByLabel("Müşteri seçin")).toHaveValue(customerId);
  await expect(page.getByLabel("En (cm)", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("sayısal giriş boş, 1000 ve Türkçe ondalık", async ({ page }) => {
  await nav(page, /^Satışlar/);
  await page
    .getByRole("button", { name: "Dijital baskı folyo", exact: true })
    .click();
  const input = page.getByLabel(/Birim fiyat/);
  await input.fill("");
  await expect(input).toHaveValue("");
  await input.pressSequentially("1000");
  await expect(input).toHaveValue("1000");
  await input.fill("1,25");
  await expect(input).toHaveValue("1,25");
  await input.fill("0.50");
  await expect(input).toHaveValue("0.50");
});
test("vinil maliyet bağlantısı ve arşiv snapshot", async ({ page }) => {
  await nav(page, /^Teklif ve Maliyet/);
  await page.getByRole("button", { name: "Malzeme ekle", exact: true }).click();
  await expect(page.getByLabel("Malzeme seç")).toHaveValue("seed-vinil");
  await expect(page.getByLabel("Varyant / genişlik")).toHaveValue(
    "seed-vinil-140",
  );
  await page
    .getByRole("button", { name: "Fiyatı ve maliyeti sabitle" })
    .click();
  const value = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("pusula.quotes.v2")!).at(-1).snapshot
        .materialCostUsd,
  );
  expect(value).toBeCloseTo(3.4272, 8);
});
test("responsive ekran ve reduced motion", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[data-compass="dashboard"]')).toHaveCount(1);
  expect(
    await page
      .locator(".compass-outer")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-dashboard.png`,
    fullPage: true,
  });
  await nav(page, /^Müşteriler ve Cari/);
  await expect(page.locator("[data-compass]")).toHaveCount(0);
});
test("giriş prototipi, pusula ve tercih", async ({ page }, info) => {
  await page.goto("/login");
  await expect(page.locator('[data-compass="login"]')).toHaveCount(1);
  await expect(page.getByText(/giriş tasarım prototipidir/)).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-login.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Demo çalışma alanını aç" }).click();
  await page.getByRole("button", { name: "Pusula hareketini kapat" }).click();
  await expect(page.locator("[data-compass]")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Pusula görünümünü aç" }),
  ).toBeVisible();
});
test("sidebar, klavye ve yeni ürün taslağı", async ({ page }) => {
  await nav(page, /^Satışlar/);
  await page.getByText("+ Yeni satılabilir ürün / hizmet").click();
  await page.getByLabel("Yeni ürün adı").fill("E2E özel hizmet");
  await page.getByRole("button", { name: "Ürünü kataloğa ekle" }).click();
  await page
    .getByRole("button", { name: "E2E özel hizmet", exact: true })
    .click();
  await expect(page.getByLabel("Ürün açıklaması")).toHaveValue(
    "E2E özel hizmet",
  );
  await page.getByRole("button", { name: "Yeni müşteri", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("Ürün açıklaması")).toHaveValue(
    "E2E özel hizmet",
  );
});
