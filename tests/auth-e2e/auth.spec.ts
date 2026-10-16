import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
loadEnvConfig(process.cwd());
test("real login MFA enrollment step-up permission matrix and logout", async ({
  page,
}, info) => {
  const fixtures = JSON.parse(
    await symmetricDecrypt({
      key: process.env.AUTH_TEST_SECRET!,
      data: await readFile(".data/auth-browser-fixtures.enc", "utf8"),
    }),
  );
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  let pageErrors = 0;
  page.on("pageerror", () => {
    pageErrors++;
  });
  const f = fixtures[info.project.name];
  console.log("Browser phase: fixture ready");
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Kurumsal e-posta").fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/account\/security/);
  console.log("Browser phase: password login and MFA gate passed");
  await page.getByLabel("Mevcut şifre").fill(f.password);
  await page.getByRole("button", { name: "TOTP kurulumunu başlat" }).click();
  await expect(
    page.getByRole("heading", { name: "Kurtarma kodlarınız" }),
  ).toBeVisible();
  const encoded = (await page
    .locator('section[aria-label="TOTP kurulumu"] code')
    .textContent())!;
  const secret = new TextDecoder().decode(base32.decode(encoded));
  await page
    .getByLabel("Doğrulama kodu", { exact: true })
    .fill(await createOTP(secret).totp());
  const verification = page.waitForResponse((r) =>
    r.url().endsWith("/two-factor/verify-totp"),
  );
  await page.getByRole("button", { name: "MFA kurulumunu doğrula" }).click();
  expect((await verification).status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Kurtarma kodlarınız" }),
  ).toHaveCount(0);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  await page
    .getByLabel("TOTP kodu", { exact: true })
    .fill(await createOTP(secret).totp());
  await page
    .getByRole("button", { name: "Yeniden doğrula", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Doğrulama başarılı");
  console.log("Browser phase: MFA and step-up passed");
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", {
      name: "Kullanıcılar ve yetkiler",
      exact: true,
    }),
  ).toBeVisible();
  console.log("Browser phase: administration loaded");
  await page.getByLabel("Kullanıcı ara").fill(f.targetName);
  await page
    .getByRole("button", { name: `${f.targetName} kullanıcısını yönet` })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Özel yetkiler", exact: true })
    .click();
  console.log("Browser phase: matrix tab open");
  await dialog
    .getByTestId("permission-materials.costView")
    .selectOption("ALLOW");
  console.log("Browser phase: ALLOW selected");
  await dialog.getByRole("button", { name: "Değişiklikleri incele" }).click();
  console.log("Browser phase: preview open");
  await expect(
    dialog.getByRole("region", { name: "Değişiklik önizlemesi" }),
  ).toContainText("USD alış maliyetini gör: İzin ver");
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" && r.url().includes("/api/cloud/users/"),
  );
  await dialog
    .getByRole("button", { name: "Değişiklikleri onayla ve kaydet" })
    .click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole("status")).toContainText(
    "Kullanıcı erişimi ve denetim kaydı kaydedildi",
    { timeout: 20000 },
  );
  await expect(dialog).toHaveCount(0, { timeout: 20000 });
  await page
    .getByRole("button", { name: `${f.targetName} kullanıcısını yönet` })
    .click();
  await dialog
    .getByRole("button", { name: "Özel yetkiler", exact: true })
    .click();
  await expect(dialog.getByTestId("permission-materials.costView")).toHaveValue(
    "ALLOW",
  );
  await dialog
    .getByTestId("permission-materials.costView")
    .selectOption("DENY");
  await dialog.getByRole("button", { name: "Değişiklikleri incele" }).click();
  await dialog
    .getByRole("button", { name: "Değişiklikleri onayla ve kaydet" })
    .click();
  await expect(dialog).toHaveCount(0, { timeout: 20000 });
  console.log("Browser phase: ALLOW and DENY persisted");
  const closeNotice = page.getByRole("button", { name: "Bildirimi kapat" });
  if (await closeNotice.isVisible()) await closeNotice.click();
  await page.locator(".table-scroll").evaluate((element) => {
    element.scrollLeft = 0;
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/auth-${info.project.name}-users.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Oturumu kapat" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Kurumsal e-posta").fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.getByLabel("TOTP doğrulama kodu")).toBeVisible();
  await page
    .getByLabel("TOTP doğrulama kodu")
    .fill(await createOTP(secret).totp());
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Oturumu kapat" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(pageErrors).toBe(0);
});
