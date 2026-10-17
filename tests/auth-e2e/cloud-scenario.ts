import { expect, type Page } from "@playwright/test";
export async function createCloudRecords(page: Page, suffix: string) {
  await page.goto("/app");
  await expect(
    page.getByRole("button", { name: "Yeni müşteri", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Yeni müşteri", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Şirket / kurum adı")
    .fill(`Cloud customer ${suffix}`);
  await page.route("**/api/cloud/workspace/customers", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "SERVICE_UNAVAILABLE" }),
    }),
  );
  await dialog
    .getByRole("button", { name: "Müşteriyi kaydet", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("kaydedilemedi");
  await expect(dialog.getByLabel("Şirket / kurum adı")).toHaveValue(
    `Cloud customer ${suffix}`,
  );
  await page.unroute("**/api/cloud/workspace/customers");
  await dialog
    .getByRole("button", { name: "Müşteriyi kaydet", exact: true })
    .click();
  await expect(
    page.getByText(`Cloud customer ${suffix}`, { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Malzemeler", exact: true }).click();
  await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ad", { exact: true }).fill(`Cloud roll ${suffix}`);
  await dialog.getByLabel("İlk varyant adı").fill("152 cm");
  await dialog.getByLabel("Genişlik (cm)", { exact: true }).fill("152");
  await dialog.getByLabel("USD alış / birim tutarı").fill("1.2");
  await dialog
    .getByRole("button", { name: "Neon'a kaydet", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Cloud roll ${suffix}` }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Ürünler", exact: true }).click();
  await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ad", { exact: true }).fill(`Cloud print ${suffix}`);
  await dialog
    .getByRole("button", { name: "Neon'a kaydet", exact: true })
    .click();
  await expect(
    page.getByText(`Cloud print ${suffix}`, { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  for (const section of ["Teklifler", "Satışlar"]) {
    await page.getByRole("button", { name: section, exact: true }).click();
    await page
      .getByRole("button", {
        name: section === "Teklifler" ? "Yeni teklif" : "Yeni satış",
        exact: true,
      })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Müşteri", exact: true })
      .selectOption({ label: `Cloud customer ${suffix}` });
    await expect(
      dialog
        .getByRole("combobox", { name: "Kullanılacak kur" })
        .locator("option"),
    ).toHaveCount(2, { timeout: 20000 });
    await dialog
      .getByRole("combobox", { name: "Kullanılacak kur" })
      .selectOption({ index: 1 });
    await dialog
      .getByLabel("Başlık / Açıklama")
      .fill(`Cloud ${section} ${suffix}`);
    await dialog
      .getByRole("combobox", { name: "Ürün", exact: true })
      .selectOption({ label: `Cloud print ${suffix}` });
    await dialog
      .getByRole("button", { name: "Malzeme ekle", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Fiyatı ve maliyeti sabitle", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Kalemi ekle", exact: true })
      .click();
    const response = page.waitForResponse(
      (r) =>
        r
          .url()
          .includes(
            `/workspace/${section === "Teklifler" ? "quotes" : "sales"}`,
          ) && r.request().method() === "POST",
      { timeout: 20000 },
    );
    await dialog
      .getByRole("button", { name: "Belgeyi Neon'a kaydet", exact: true })
      .click();
    expect((await response).status()).toBe(200);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText(`Cloud customer ${suffix}`, { exact: true }),
    ).toBeVisible({ timeout: 20000 });
  }
  await page.screenshot({
    path: `test-results/cloud-${suffix}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
export async function verifyCloudRecords(page: Page, suffix: string) {
  await page.goto("/app");
  await expect(
    page.getByText(`Cloud customer ${suffix}`, { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.reload();
  await expect(
    page.getByText(`Cloud customer ${suffix}`, { exact: true }),
  ).toBeVisible({ timeout: 20000 });
}
