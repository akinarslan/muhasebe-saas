import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Client } from "pg";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { fixtureFile } from "../../scripts/auth/fixture-files";
import { assertDevelopmentTarget } from "../../src/server/db/target";
import {
  resetLocalFixtureRateLimits,
  warmLocalFixtureAuth,
} from "./local-isolation";

test("V4.2 supplier cards links immutable offers comparison and drafts", async ({
  page,
}, info) => {
  test.skip(
    !process.env.PUSULA_LOCAL_FIXTURE,
    "V4.2 is approved only on the new isolated local fixture",
  );
  test.setTimeout(180000);
  await resetLocalFixtureRateLimits();
  await warmLocalFixtureAuth(page.request);
  page.setDefaultTimeout(20000);
  const fixtures = JSON.parse(
    await symmetricDecrypt({
      key: process.env.AUTH_TEST_SECRET!,
      data: await readFile(fixtureFile("auth-browser-fixtures.enc"), "utf8"),
    }),
  );
  const f = fixtures[info.project.name];
  assertDevelopmentTarget(process.env.TEST_DIRECT_DATABASE_URL, true, true);
  const admin = new Client({
    connectionString: process.env.TEST_DIRECT_DATABASE_URL,
  });
  await admin.connect();
  let secret = "";
  try {
    const r = await admin.query(
      'SELECT t.secret FROM "AuthTwoFactor" t JOIN "AuthUser" u ON u.id=t."userId" WHERE u.email=$1',
      [f.email],
    );
    secret = await symmetricDecrypt({
      key: process.env.AUTH_TEST_SECRET!,
      data: r.rows[0].secret,
    });
  } finally {
    await admin.end();
  }
  let pageErrors = 0,
    unexpectedConsole = 0;
  page.on("pageerror", () => pageErrors++);
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/Failed to load resource:.*\b(401|403|409|503)\b|destination stream errored/.test(
        m.text(),
      )
    )
      unexpectedConsole++;
  });
  await page.goto("/login");
  await page.getByLabel("Kurumsal e-posta").fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page
    .getByLabel("TOTP doğrulama kodu")
    .fill(await createOTP(secret).totp());
  await page
    .getByRole("button", { name: "Doğrula ve devam et", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Tedarikçiler", exact: true }).click();
  const workspace = page.getByRole("region", {
    name: "Tedarikçi yönetimi",
    exact: true,
  });
  await expect(workspace).toBeVisible();
  await expect(
    workspace.getByRole("textbox", { name: "Tedarikçi ara" }),
  ).toBeVisible();
  const name = `V42 Browser ${info.project.name}`;
  await workspace
    .getByRole("button", { name: "Yeni tedarikçi", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Tedarikçi formunu kapat", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Tedarikçiyi kaydet", exact: true }),
  ).toBeFocused();
  await dialog.getByLabel("Firma adı", { exact: true }).fill(name);
  await dialog.getByLabel("Ticari unvan").fill("Imaginary Supplies Ltd");
  await dialog.getByLabel("Termin (gün)").fill("4");
  page.once("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Firma adı", { exact: true })).toHaveValue(
    name,
  );
  await page.route("**/api/cloud/workspace/suppliers", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "SERVICE_UNAVAILABLE" }),
        })
      : route.continue(),
  );
  await dialog
    .getByRole("button", { name: "Tedarikçiyi kaydet", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "girdileriniz korunuyor",
  );
  await expect(dialog.getByLabel("Firma adı", { exact: true })).toHaveValue(
    name,
  );
  await page.unroute("**/api/cloud/workspace/suppliers");
  await dialog
    .getByRole("button", { name: "Tedarikçiyi kaydet", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    workspace.getByText("Kayıt buluta kaydedildi.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Tedarikçiler", exact: true }).click();
  await page
    .getByRole("button", { name: `Detay: ${name}`, exact: true })
    .click();
  await workspace
    .getByRole("button", { name: "Malzeme bağla", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  const options = dialog.getByLabel("Malzeme varyantı").locator("option");
  expect(await options.count()).toBeGreaterThan(0);
  await dialog.getByLabel("Tedarikçi ürün kodu").fill("BROWSER-SKU");
  await dialog
    .getByRole("combobox", { name: "Alış birimi", exact: true })
    .selectOption("square_meter");
  await dialog
    .getByRole("button", { name: "Eşleştirmeyi kaydet", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await workspace
    .getByRole("button", { name: "Yeni teklif sürümü", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Orijinal birim fiyat").fill("2");
  await dialog
    .getByRole("button", { name: "Teklif sürümünü kaydet", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    workspace.getByText("v1", { exact: false }).first(),
  ).toBeVisible();
  await workspace
    .getByRole("button", { name: "Yeni teklif sürümü", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Orijinal birim fiyat").fill("3");
  await dialog
    .getByRole("button", { name: "Teklif sürümünü kaydet", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await workspace.getByLabel("Tüm fiyat geçmişini göster").check();
  await expect(
    workspace.locator(".supplier-detail .cloud-table tbody tr"),
  ).toHaveCount(2);
  const selectedVariant = await workspace
    .getByLabel("Karşılaştırma varyantı")
    .locator("option")
    .nth(1)
    .getAttribute("value");
  await workspace
    .getByLabel("Karşılaştırma varyantı")
    .selectOption(selectedVariant!);
  await workspace.getByLabel("Temel birim miktarı").fill("10");
  await workspace
    .getByRole("button", { name: "Fiyatları karşılaştır", exact: true })
    .click();
  await expect(
    workspace.getByText("Karşılaştırılabilir en düşük fiyat", { exact: true }),
  ).toBeVisible();
  await workspace.getByLabel("Temel birim miktarı").fill("0.5");
  await expect(
    workspace.getByText("Karşılaştırılabilir en düşük fiyat", { exact: true }),
  ).toHaveCount(0);
  await workspace.getByLabel("Temel birim miktarı").fill("10");
  await workspace
    .getByRole("button", { name: "Fiyatları karşılaştır", exact: true })
    .click();
  await expect(
    workspace.getByText("Karşılaştırılabilir en düşük fiyat", { exact: true }),
  ).toBeVisible();
  await workspace.getByRole("textbox", { name: "Tedarikçi ara" }).focus();
  const styles = await workspace
    .getByRole("textbox", { name: "Tedarikçi ara" })
    .evaluate((el) => {
      const i = getComputedStyle(el),
        p = getComputedStyle(el.parentElement!);
      return {
        inner: i.borderTopWidth,
        shadow: i.boxShadow,
        outer: p.borderTopWidth,
        focus: p.boxShadow,
      };
    });
  expect(styles.inner).toBe("0px");
  expect(styles.shadow).toBe("none");
  expect(styles.outer).toBe("1px");
  expect(styles.focus).not.toBe("none");
  await workspace
    .getByRole("textbox", { name: "Tedarikçi ara" })
    .fill("no-matching-v42-supplier");
  await expect(
    workspace.getByText("Bu filtrede tedarikçi bulunamadı."),
  ).toBeVisible();
  await workspace.getByRole("textbox", { name: "Tedarikçi ara" }).fill("");
  const layout = await workspace.evaluate((el) => {
    const panel = el.closest(".cloud-panel")!;
    const r = el.getBoundingClientRect(),
      p = panel.getBoundingClientRect();
    return {
      overflow: el.scrollWidth > el.clientWidth + 1,
      panelScroll: panel.scrollLeft,
      left: r.left,
      right: r.right,
      panelLeft: p.left,
      panelRight: p.right,
    };
  });
  expect(layout.overflow).toBe(false);
  expect(layout.panelScroll).toBe(0);
  expect(layout.left).toBeGreaterThanOrEqual(layout.panelLeft);
  expect(layout.right).toBeLessThanOrEqual(layout.panelRight);
  const folder = join(dirname(fixtureFile("target.json")), "screenshots");
  await mkdir(folder, { recursive: true });
  await page.screenshot({
    path: join(folder, `v42-${info.project.name}.png`),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await workspace
    .getByRole("button", { name: "Tedarikçiyi düzenle", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Durum", exact: true })
    .selectOption("false");
  await dialog
    .getByRole("button", { name: "Tedarikçiyi kaydet", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await workspace.getByLabel("Aktiflik").selectOption("false");
  await expect(
    workspace.getByRole("button", { name: `Detay: ${name}`, exact: true }),
  ).toBeVisible();
  expect(pageErrors).toBe(0);
  expect(unexpectedConsole).toBe(0);
});
