import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { symmetricDecrypt } from "better-auth/crypto";
import { localFreshTotp, expireLocalFixtureStepUp } from "./local-isolation";
import { base32 } from "@better-auth/utils/base32";
import { fixtureFile } from "../../scripts/auth/fixture-files";
import {
  resetLocalFixtureRateLimits,
  warmLocalFixtureAuth,
} from "./local-isolation";

test("V4.3b real receipt post ledger lot and mobile dirty guard", async ({
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
  const f = fixtures["stock-" + info.project.name];
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

  const step = await page.request.post("/api/auth/step-up", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { password: f.password, code: await localFreshTotp(secret) },
  });
  expect(step.status()).toBe(200);
  const order = await post("purchase-orders", {
    supplierId: supplier.id,
    idempotencyKey: randomUUID(),
    revisesOrderId: null,
    lines: [
      {
        supplierMaterialId: link.id,
        offerVersionId: null,
        orderedQty: "2",
        purchaseUnit: "linear_meter",
        expectedDate: null,
        manualCurrency: "USD",
        manualUnitPrice: "15.2",
      },
    ],
  });
  await post("purchase-orders/" + order.id + "/approve", { version: 1 });
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Mal Kabul ve Stok", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mal Kabul ve Stok", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Depo kodu", { exact: true })
    .fill("BR" + randomUUID().slice(0, 8));
  await page.getByLabel("Depo adı", { exact: true }).fill("Browser warehouse");
  const locationCreated = page.waitForResponse(
    (r) =>
      r.url().includes("/stock/locations") && r.request().method() === "POST",
  );
  await expect(
    page.getByRole("button", { name: "Depo oluştur", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Depo oluştur", exact: true }).click();
  expect((await locationCreated).status()).toBe(200);
  await expect(page.getByLabel("Depo kodu", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Teslim al", exact: true }).click();
  const drawer = page.getByRole("dialog", {
    name: "Onaylı siparişten teslim al",
  });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByLabel("Onaylı sipariş", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      drawer
        .getByLabel("Onaylı sipariş", { exact: true })
        .locator("option")
        .count(),
    )
    .toBeGreaterThan(1);
  await drawer
    .getByLabel("Onaylı sipariş", { exact: true })
    .selectOption(order.id);
  await drawer.getByLabel("Depo", { exact: true }).selectOption({ index: 1 });
  await drawer.getByLabel("İrsaliye / kaynak referansı").fill("Browser GR");
  await drawer.getByLabel("Gelen miktar", { exact: true }).fill("2");
  await drawer.getByRole("checkbox").check();
  page.once("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await expect(drawer).toBeVisible();
  await drawer.getByLabel("Gelen miktar", { exact: true }).fill("0");
  await drawer
    .getByRole("button", { name: "Taslağı kaydet", exact: true })
    .click();
  await expect(drawer.getByRole("alert")).toHaveText("INVALID_INPUT");
  await expect(drawer).toBeVisible();
  await drawer.getByLabel("Gelen miktar", { exact: true }).fill("2");
  await drawer
    .getByRole("button", { name: "Taslağı kaydet", exact: true })
    .click();
  await expect(drawer).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Teslim al", exact: true }),
  ).toBeFocused();
  await expireLocalFixtureStepUp(f.email);
  const deniedPost = page.waitForResponse(
    (r) => r.url().includes("/post") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Kesinleştir", exact: true }).click();
  expect((await deniedPost).status()).toBe(403);
  const verification = page.getByRole("dialog", {
    name: "Güvenlik doğrulaması",
  });
  await expect(verification).toBeVisible();
  await verification.getByLabel("Şifre", { exact: true }).fill(f.password);
  await verification
    .getByLabel("TOTP kodu", { exact: true })
    .fill(await localFreshTotp(secret));
  await verification
    .getByRole("button", { name: "Yeniden doğrula", exact: true })
    .click();
  await expect(verification).toHaveCount(0);
  await page.route(
    "**/goods-receipts/*/post",
    (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "RECEIPT_STATE_CONFLICT" }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Kesinleştir", exact: true }).click();
  await expect(
    page.getByText("RECEIPT_STATE_CONFLICT", { exact: true }),
  ).toBeVisible();
  await page.route(
    "**/goods-receipts/*/post",
    (route) => route.abort("failed"),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Kesinleştir", exact: true }).click();
  await expect(
    page.getByText(
      "Kontrol anında işlem kesinleşmemiş. Aynı kayıt üzerinden durumu kontrol edin.",
      { exact: true },
    ),
  ).toBeVisible();
  // Commit in the actual isolated PostgreSQL backend, then lose the response.
  await page.route(
    "**/goods-receipts/*/post",
    async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Kesinleştir", exact: true }).click();
  await expect(
    page.getByText("Mal kabul kesinleşti; kayıt durumu doğrulandı.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "POSTED", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "3.04 m²", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^LOT-/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Lot ayrıntısı" }),
  ).toBeVisible();
  await expect(page.getByText(/İlk uzunluk: 2 m/)).toBeVisible();
  await page
    .getByRole("dialog", { name: "Lot ayrıntısı" })
    .getByRole("button", { name: "Kapat", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Mal Kabul ve Stok", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "POSTED", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  page.once("dialog", (dialog) => dialog.accept("Browser correction"));
  await page.route(
    "**/goods-receipts/*/reverse",
    async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Ters kayıt", exact: true }).click();
  await expect(
    page.getByText("Ters kayıt tamamlandı; kayıt durumu doğrulandı.", {
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("Browser second correction"));
  await page.route(
    "**/goods-receipts/*/reverse",
    (route) => route.abort("failed"),
    { times: 1 },
  );
  await page.route(
    "**/goods-receipts/*/outcome?*",
    (route) => route.abort("failed"),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Ters kayıt", exact: true }).click();
  await expect(
    page.getByText("İşlem sonucu doğrulanamadı; kayıt durumunu kontrol edin.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toBe(0);
});
