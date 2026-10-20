import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { symmetricDecrypt } from "better-auth/crypto";
import { localFreshTotp } from "./local-isolation";
import { base32 } from "@better-auth/utils/base32";
import { fixtureFile } from "../../scripts/auth/fixture-files";
import {
  resetLocalFixtureRateLimits,
  warmLocalFixtureAuth,
} from "./local-isolation";

test("V4.3a real PO create edit dirty guard step-up approve and cancel", async ({
  page,
}, info) => {
  test.skip(!process.env.PUSULA_LOCAL_FIXTURE, "Isolated local fixture only");
  test.setTimeout(240000);
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  await resetLocalFixtureRateLimits();
  await warmLocalFixtureAuth(page.request);
  const fixtures = JSON.parse(
    await symmetricDecrypt({
      key: process.env.AUTH_TEST_SECRET!,
      data: await readFile(fixtureFile("auth-browser-fixtures.enc"), "utf8"),
    }),
  );
  const f = fixtures[info.project.name];
  let errors = 0;
  page.on("pageerror", () => errors++);
  await page.goto("/login");
  await page.getByLabel("Kurumsal e-posta").fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  const loginResponse = page.waitForResponse(
    (r) =>
      r.url().includes("/sign-in/email") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/, { timeout: 30000 });
  await page.goto("/account/security");
  await page.getByLabel("Mevcut şifre").fill(f.password);
  const enabledMfa = page.waitForResponse(
    (r) =>
      r.url().includes("/two-factor/enable") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "TOTP kurulumunu başlat" }).click();
  expect((await enabledMfa).status()).toBe(200);
  const encoded = (await page
    .locator('section[aria-label="TOTP kurulumu"] code')
    .textContent())!;
  const secret = new TextDecoder().decode(base32.decode(encoded));
  await page
    .getByLabel("Doğrulama kodu", { exact: true })
    .fill(await localFreshTotp(secret));
  const verifiedMfa = page.waitForResponse(
    (r) =>
      r.url().includes("/two-factor/verify-totp") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "MFA kurulumunu doğrula" }).click();
  expect((await verifiedMfa).status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Kurtarma kodlarınız" }),
  ).toHaveCount(0);
  await page.goto("/app");
  console.log("Browser phase: purchase login passed");
  const metaResponse = await page.request.get("/api/cloud/context");
  expect(metaResponse.status()).toBe(200);
  const meta = await metaResponse.json();
  const scope = { legalEntityId: meta.companies[0].id, activityId: null };
  const post = async (path: string, body: object) => {
    const r = await page.request.post("/api/cloud/workspace/" + path, {
      headers: { Origin: "http://127.0.0.1:3100" },
      data: { ...scope, ...body },
    });
    expect(r.status()).toBe(200);
    return r.json();
  };
  const material = await post("materials", {
    idempotencyKey: randomUUID(),
    name: "PO Browser Vinyl",
    unit: "square_meter",
    roll: true,
    category: "Test",
    margins: { left: 0, right: 0, top: 0, bottom: 0 },
    variants: [{ name: "152cm", widthCm: 152, usdCost: "4", inStock: true }],
  });
  const materialResponse = await page.request.get(
    "/api/cloud/workspace/catalog?company=" + scope.legalEntityId,
  );
  expect(materialResponse.status()).toBe(200);
  const materials = await materialResponse.json();
  const variant = materials.find((m: { id: string }) => m.id === material.id)
    .variants[0];
  const supplier = await post("suppliers", {
    idempotencyKey: randomUUID(),
    name: "PO Browser Supplier",
    defaultCurrency: "USD",
    leadTimeDays: 2,
  });
  const link = await post("suppliers/" + supplier.id + "/materials", {
    idempotencyKey: randomUUID(),
    variantId: variant.id,
    supplierSku: "BROWSER-152",
    purchaseUnit: "linear_meter",
    minOrderQty: "1",
    leadTimeDays: 2,
  });
  console.log("Browser phase: purchase fixtures ready");
  await page
    .getByRole("button", { name: "Satın Alma Siparişleri", exact: true })
    .click();
  const region = page.getByRole("region", {
    name: "Satın alma siparişleri",
    exact: true,
  });
  await region
    .getByRole("button", { name: "Yeni sipariş", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Tedarikçi", exact: true })
    .selectOption(supplier.id);
  await dialog.getByLabel("Malzeme eşleştirmesi").selectOption(link.id);
  await dialog.getByLabel("Miktar", { exact: true }).fill("2");
  await dialog.getByLabel("Manuel birim fiyat").fill("15.20");
  const created = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" && r.url().endsWith("/purchase-orders"),
  );
  await dialog
    .getByRole("button", { name: "Sipariş taslağı oluştur", exact: true })
    .click();
  expect((await created).status()).toBe(200);
  console.log("Browser phase: purchase draft saved");
  await expect(dialog).toHaveCount(0);
  await expect(region.getByText(/30\.400000000 USD/).first()).toBeVisible();
  await region
    .getByRole("button", { name: "Taslağı düzenle", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Manuel birim fiyat")).toHaveValue("15.2");
  await expect(dialog.getByLabel("Manuel para birimi")).toHaveValue("USD");
  await dialog.getByLabel("Miktar", { exact: true }).fill("3");
  let confirms = 0;
  const reject = (d: import("@playwright/test").Dialog) => {
    confirms++;
    void d.dismiss();
  };
  page.on("dialog", reject);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(confirms).toBe(1);
  await expect(dialog.getByLabel("Miktar", { exact: true })).toHaveValue("3");
  page.off("dialog", reject);
  page.once("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const denied = page.waitForResponse((r) => r.url().includes("/approve"));
  await region.getByRole("button", { name: "Onayla", exact: true }).click();
  expect((await denied).status()).toBe(403);
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Şifre", { exact: true }).fill(f.password);
  await dialog
    .getByLabel("TOTP kodu", { exact: true })
    .fill(await localFreshTotp(secret));
  await dialog
    .getByRole("button", { name: "Yeniden doğrula", exact: true })
    .click();
  // The shared step-up component invokes onVerified immediately after success.
  await expect(dialog).toHaveCount(0);
  const approved = page.waitForResponse((r) => r.url().includes("/approve"));
  await region.getByRole("button", { name: "Onayla", exact: true }).click();
  expect((await approved).status()).toBe(200);
  await expect(
    region.getByRole("button", { name: "Taslağı düzenle", exact: true }),
  ).toHaveCount(0);
  const cancelled = page.waitForResponse((r) => r.url().includes("/cancel"));
  await region.getByRole("button", { name: "İptal et", exact: true }).click();
  expect((await cancelled).status()).toBe(200);
  await expect(
    region.getByRole("button", { name: "Onayla", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toBe(0);
  console.log("Browser phase: purchase smoke passed");
});
