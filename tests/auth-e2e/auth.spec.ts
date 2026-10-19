import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { Client } from "pg";
import { assertDevelopmentTarget } from "../../src/server/db/target";
import { base32 } from "@better-auth/utils/base32";
import { createCloudRecords, verifyCloudRecords } from "./cloud-scenario";
import { fixtureFile } from "../../scripts/auth/fixture-files";
import {
  resetLocalFixtureRateLimits,
  warmLocalFixtureAuth,
} from "./local-isolation";
loadEnvConfig(process.cwd());
test("real login MFA enrollment step-up permission matrix and logout", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(300000);
  await resetLocalFixtureRateLimits();
  await warmLocalFixtureAuth(page.request);
  const fixtures = JSON.parse(
    await symmetricDecrypt({
      key: process.env.AUTH_TEST_SECRET!,
      data: await readFile(fixtureFile("auth-browser-fixtures.enc"), "utf8"),
    }),
  );
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  let pageErrors = 0;
  const consoleErrors = {
    expectedHttp: 0,
    knownDevelopmentStream: 0,
    knownPgDeprecation: 0,
    unexpected: 0,
  };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (/Failed to load resource:.*\b(401|403|409|429|502|503)\b/.test(value))
      consoleErrors.expectedHttp++;
    else if (value.includes("destination stream errored"))
      consoleErrors.knownDevelopmentStream++;
    else if (
      value.includes(
        "DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.",
      )
    )
      consoleErrors.knownPgDeprecation++;
    else {
      consoleErrors.unexpected++;
      if (process.env.PUSULA_LOCAL_FIXTURE)
        console.warn(
          "Unexpected local browser console:",
          value
            .replaceAll(f.password, "[redacted]")
            .replaceAll(f.email, "[fixture]")
            .slice(0, 700),
        );
    }
  });
  page.on("pageerror", () => {
    pageErrors++;
  });
  const f = fixtures[info.project.name];
  console.log("Browser phase: fixture ready");
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/login/, { timeout: 20000 });
  await page.getByLabel("Kurumsal e-posta").fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  const initialLogin = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/sign-in/email") &&
      r.request().method() === "POST",
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  expect((await initialLogin).status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/, { timeout: 20000 });
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
  await expect(
    page.getByRole("heading", { name: "Kimliğiniz başarıyla doğrulandı" }),
  ).toBeVisible();
  await expect(page.getByLabel("Şifre", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Yeniden doğrula", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Kimliğiniz başarıyla doğrulandı" }),
  ).toBeVisible();
  console.log("Browser phase: MFA and step-up passed");
  await page
    .getByRole("link", { name: "Kullanıcı yönetimine devam et" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Kullanıcılar ve yetkiler",
      exact: true,
    }),
  ).toBeVisible();
  console.log("Browser phase: administration loaded");
  await page.getByRole("button", { name: "Kullanıcı davet et" }).click();
  const duplicateDrawer = page.getByRole("dialog", {
    name: "Yeni kullanıcı daveti",
  });
  await duplicateDrawer.getByLabel("Ad soyad").fill("Existing fixture");
  await duplicateDrawer.getByLabel("E-posta", { exact: true }).fill(f.email);
  const conflict = page.waitForResponse((r) =>
    r.url().endsWith("/api/cloud/users/invite"),
  );
  await duplicateDrawer
    .getByRole("button", { name: "Davet oluştur", exact: true })
    .click();
  expect((await conflict).status()).toBe(409);
  await expect(duplicateDrawer).toBeVisible();
  await expect(duplicateDrawer.getByRole("alert")).toContainText(
    "zaten firma üyesi",
  );
  await expect(duplicateDrawer.getByLabel("Ad soyad")).toHaveValue(
    "Existing fixture",
  );
  await page.getByRole("button", { name: "Davet panelini kapat" }).click();
  console.log("C61 existing member conflict keeps drawer and inputs");
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
  await page.getByRole("button", { name: "Kullanıcı davet et" }).click();
  const invitationName = `C61 ${info.project.name} ${Date.now()}`;
  const invitationEmail = `browser-c61-${Date.now()}@example.invalid`;
  assertDevelopmentTarget(process.env.TEST_AUTH_DATABASE_URL, true);
  const testDb = new Client({
    connectionString: process.env.TEST_AUTH_DATABASE_URL,
  });
  await testDb.connect();
  try {
    await testDb.query(
      'UPDATE "AuthSession" SET "stepUpAt"=$2 WHERE "userId"=(SELECT id FROM "AuthUser" WHERE email=$1)',
      [f.email, new Date(Date.now() - 360000)],
    );
  } finally {
    await testDb.end();
  }
  await dialog.getByLabel("Ad soyad").fill(invitationName);
  await dialog.getByLabel("E-posta", { exact: true }).fill(invitationEmail);
  const stepUpRequired = page.waitForResponse((r) =>
    r.url().endsWith("/api/cloud/users/invite"),
  );
  await dialog
    .getByRole("button", { name: "Davet oluştur", exact: true })
    .click();
  const stepDialog = page.getByRole("dialog", {
    name: "Güvenlik doğrulaması",
    exact: true,
  });
  expect((await stepUpRequired).status()).toBe(403);
  await expect(stepDialog).toBeVisible({ timeout: 20000 });
  await stepDialog.getByLabel("Şifre", { exact: true }).fill(f.password);
  await stepDialog
    .getByLabel("TOTP kodu", { exact: true })
    .fill(await createOTP(secret).totp());
  await stepDialog
    .getByRole("button", { name: "Yeniden doğrula", exact: true })
    .click();
  await expect(stepDialog).toHaveCount(0);
  await expect(dialog.getByLabel("Ad soyad")).toHaveValue(invitationName);
  await expect(dialog.getByLabel("E-posta", { exact: true })).toHaveValue(
    invitationEmail,
  );
  await dialog
    .getByRole("button", { name: "Davet oluştur", exact: true })
    .click();
  await expect(dialog).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByRole("status")).toContainText(
    "yerel test taşıyıcısına",
  );
  await page.getByLabel("Kullanıcı ara").fill(invitationName);
  await expect(
    page.getByRole("row").filter({ hasText: invitationName }),
  ).toContainText("Davet: Yerel test");
  await page
    .getByRole("button", { name: `${invitationName} kullanıcısını yönet` })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Daveti yeniden gönder", exact: true }),
  ).toBeVisible();
  await page.route("**/api/cloud/users/*/resend-invite", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: "MAIL_SEND_FAILED",
        requestId: "00000000-0000-4000-8000-000000000062",
      }),
    }),
  );
  await dialog
    .getByRole("button", { name: "Daveti yeniden gönder", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.unroute("**/api/cloud/users/*/resend-invite");
  await page.getByRole("button", { name: "Kullanıcı panelini kapat" }).click();

  // Existing pending invitations are conflicts; never trigger another send.
  await page.getByRole("button", { name: "Kullanıcı davet et" }).click();
  await dialog.getByLabel("Ad soyad").fill(invitationName);
  await dialog.getByLabel("E-posta", { exact: true }).fill(invitationEmail);
  const pendingConflict = page.waitForResponse((r) =>
    r.url().endsWith("/api/cloud/users/invite"),
  );
  await dialog
    .getByRole("button", { name: "Davet oluştur", exact: true })
    .click();
  expect((await pendingConflict).status()).toBe(409);
  await expect(dialog.getByRole("alert")).toContainText("bekleyen davet var");
  await expect(dialog.getByLabel("E-posta", { exact: true })).toHaveValue(
    invitationEmail,
  );
  await dialog
    .getByRole("button", { name: "Mevcut daveti yönet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Daveti yeniden gönder", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Kullanıcı panelini kapat", exact: true })
    .click();
  // Exercise provider failure UX without contacting a real mail service.
  await page.route("**/api/cloud/users/invite", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: "MAIL_SEND_FAILED",
        requestId: "00000000-0000-4000-8000-000000000061",
      }),
    }),
  );
  await page.getByRole("button", { name: "Kullanıcı davet et" }).click();
  await dialog.getByLabel("Ad soyad").fill("Failed fixture");
  await dialog
    .getByLabel("E-posta", { exact: true })
    .fill("failure@example.invalid");
  await dialog
    .getByRole("button", { name: "Davet oluştur", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "E-posta gönderilemedi",
  );
  await expect(page.locator(".toast")).toHaveCount(0);
  await expect(dialog.getByLabel("Ad soyad")).toHaveValue("Failed fixture");
  await expect(dialog.getByLabel("E-posta", { exact: true })).toHaveValue(
    "failure@example.invalid",
  );
  await page.screenshot({
    path: `test-results/auth-${info.project.name}-invite-failure.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Davet panelini kapat" }).click();
  await page.unroute("**/api/cloud/users/invite");
  await createCloudRecords(page, info.project.name);
  await page.getByRole("button", { name: "Oturumu kapat" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Kurumsal e-posta").fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.getByLabel("TOTP doğrulama kodu")).toBeVisible();
  await expect(page.getByLabel("TOTP doğrulama kodu")).toBeFocused();
  await expect(page.getByLabel("TOTP doğrulama kodu")).toHaveValue("");
  await expect(page.getByLabel("Hesap e-postası")).toHaveAttribute(
    "readonly",
    "",
  );
  await page
    .getByRole("button", { name: "Hesap değiştir", exact: true })
    .click();
  await expect(page.getByLabel("Kurumsal e-posta")).toBeVisible();
  await page.getByLabel("Kurumsal e-posta").fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.getByLabel("TOTP doğrulama kodu")).toBeFocused();
  await page
    .getByLabel("TOTP doğrulama kodu")
    .fill(await createOTP(secret).totp());
  await page
    .getByRole("button", { name: "Doğrula ve devam et", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await verifyCloudRecords(page, info.project.name);
  const independent = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  try {
    const second = await independent.newPage();
    await second.goto("http://127.0.0.1:3100/login");
    await second.getByLabel("Kurumsal e-posta").fill(f.email);
    await second.getByLabel("Şifre", { exact: true }).fill(f.password);
    await second
      .getByRole("button", { name: "Giriş yap", exact: true })
      .click();
    await second
      .getByLabel("TOTP doğrulama kodu")
      .fill(await createOTP(secret).totp());
    await second
      .getByRole("button", { name: "Doğrula ve devam et", exact: true })
      .click();
    await expect(second).toHaveURL(/\/app$/);
    await verifyCloudRecords(second, info.project.name);
  } finally {
    await independent.close();
  }
  await page.getByRole("button", { name: "Oturumu kapat" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(pageErrors).toBe(0);
  console.log("Browser console audit (counts only):", consoleErrors);
  expect(consoleErrors.unexpected).toBe(0);
});
