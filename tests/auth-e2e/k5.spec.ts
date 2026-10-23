import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { symmetricDecrypt } from "better-auth/crypto";
import { base32 } from "@better-auth/utils/base32";
import { fixtureFile } from "../../scripts/auth/fixture-files";
import {
  localFreshTotp,
  resetLocalFixtureRateLimits,
  warmLocalFixtureAuth,
} from "./local-isolation";

test("K5 integrated operation lost response offline reopen", async ({
  page,
}, info) => {
  test.skip(!process.env.PUSULA_LOCAL_FIXTURE, "Isolated fixture only");
  test.setTimeout(240000);
  page.setDefaultTimeout(20000);
  await resetLocalFixtureRateLimits();
  await warmLocalFixtureAuth(page.request);
  const fixtures = JSON.parse(
    await symmetricDecrypt({
      key: process.env.AUTH_TEST_SECRET!,
      data: await readFile(fixtureFile("auth-browser-fixtures.enc"), "utf8"),
    }),
  );
  const f = fixtures[info.project.name];
  await page.goto("/login");
  await page.getByLabel("Kurumsal e-posta").fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/account/security");
  await page.getByLabel("Mevcut şifre").fill(f.password);
  await page.getByRole("button", { name: "TOTP kurulumunu başlat" }).click();
  const encoded = (await page
    .locator('section[aria-label="TOTP kurulumu"] code')
    .textContent())!;
  const secret = new TextDecoder().decode(base32.decode(encoded));
  await page
    .getByLabel("Doğrulama kodu", { exact: true })
    .fill(await localFreshTotp(secret));
  const verified = page.waitForResponse(
    (r) =>
      r.url().includes("/two-factor/verify-totp") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "MFA kurulumunu doğrula" }).click();
  expect((await verified).status()).toBe(200);
  await expect(page.locator('section[aria-label="TOTP kurulumu"]')).toHaveCount(
    0,
    { timeout: 20000 },
  );
  const step = await page.request.post("/api/auth/step-up", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { password: f.password, code: await localFreshTotp(secret) },
  });
  expect(step.status()).toBe(200);
  const meta = await (await page.request.get("/api/cloud/context")).json(),
    scope = { legalEntityId: meta.companies[0].id, activityId: null };
  const post = async (path: string, body: object) => {
    const r = await page.request.post("/api/cloud/workspace/" + path, {
      headers: { Origin: "http://127.0.0.1:3100" },
      data: { ...scope, ...body },
    });
    expect(r.status(), path).toBe(200);
    return r.json();
  };
  const intent = async (kind: string) =>
    (await post("finance/intents", { kind, clientKey: randomUUID() })).id;
  const cash = (
    await post("finance/funds", { kind: "CASH", label: "K5 acceptance cash" })
  ).id;
  const customer = await post("customers", {
    idempotencyKey: randomUUID(),
    name: "K5 browser customer",
  });
  const material = await post("materials", {
    idempotencyKey: randomUUID(),
    name: "K5 browser vinyl",
    unit: "square_meter",
    roll: true,
    margins: { left: 2, right: 2, top: 2, bottom: 2 },
    variants: [{ name: "152", widthCm: 152, inStock: true, usdCost: "2" }],
  });
  const catalog = await (
    await page.request.get(
      `/api/cloud/workspace/catalog?company=${scope.legalEntityId}`,
    )
  ).json();
  const variant = catalog.find((m: { id: string }) => m.id === material.id)
    .variants[0].id;
  const product = await post("products", {
    idempotencyKey: randomUUID(),
    name: "K5 vinyl printing",
    kind: "manufacture",
    unit: "m²",
  });
  const rateResponse = await page.request.post("/api/cloud/exchange-rate", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { usdTry: "40", reason: "K5 browser synthetic rate" },
  });
  expect(rateResponse.status()).toBe(201);
  const rate = await rateResponse.json();
  const sale = await post("sales", {
    customerId: customer.id,
    date: "2026-10-26",
    dueDate: "2026-10-29",
    currency: "TRY",
    notes: "K5 10m2 browser",
    rate: { kind: "manual", id: rate.id },
    plans: [],
    idempotencyKey: randomUUID(),
    sourceRef: `intent:${await intent("SALE")}`,
    lines: [
      {
        productId: product.id,
        description: "100x200cm x5 vinyl10m2",
        quantity: 5,
        widthCm: 100,
        heightCm: 200,
        discount: 0,
        vat: 20,
        costing: {
          materials: [
            {
              id: "vinyl",
              materialId: material.id,
              variantId: variant,
              widthCm: 100,
              heightCm: 200,
              quantity: 5,
              left: 2,
              right: 2,
              top: 2,
              bottom: 2,
              reusableM2: 0,
            },
          ],
          expenses: [],
          method: "margin",
          targetPercent: 50,
          manualNetUsd: 100,
          vat: 20,
        },
      },
    ],
  });
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Cari ve Finans", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Finans çalışma alanı" });
  const expenses = panel.getByRole("region", {
    name: "İşletme giderleri ve finans özeti",
  });
  await expenses.getByLabel("Rapor başlangıç").fill("2026-10-26");
  await expenses.getByLabel("Rapor bitiş").fill("2026-10-26");
  const row = panel.locator("tr").filter({ hasText: sale.id });
  await expect(row).toContainText("4.800,00 TL");
  let posts = 0;
  const dropped = page.waitForEvent(
    "requestfailed",
    (request) =>
      request.url().includes("/finance/collect") && request.method() === "POST",
  );
  await page.route(/\/finance\/collect(?:\?|$)/, async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      const committed = await route.fetch();
      expect(committed.status()).toBe(200);
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await row.getByRole("button", { name: "Tahsilat al", exact: true }).click();
  let form = panel.getByRole("form", { name: "Tahsilat ödeme formu" });
  await form.getByLabel("Tutar (TL)", { exact: true }).fill("2.000,00");
  await form.getByLabel("İşlem tarihi").fill("26.10.2026");
  await form.getByLabel("Para hesabı").selectOption(cash);
  await form
    .getByRole("button", { name: "Tahsilatı kaydet", exact: true })
    .click();
  await expect(
    panel.getByText("Bekleyen işlem referansı:", { exact: false }),
  ).toBeVisible();
  await dropped;
  expect(posts).toBe(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Cari ve Finans", exact: true })
    .click();
  await expect(
    panel.getByText("Bekleyen işlem referansı:", { exact: false }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Sonucu sorgula", exact: true })
    .click();
  await expect(
    panel.getByText("Bekleyen işlem referansı:", { exact: false }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Finans verilerini yenile" }),
  ).toBeEnabled();
  await expect(row).toContainText("2.800,00 TL");
  expect(posts).toBe(1);
  await page.unroute(/\/finance\/collect(?:\?|$)/);
  await expenses.getByLabel("Rapor başlangıç").fill("2026-10-26");
  await expenses.getByLabel("Rapor bitiş").fill("2026-10-26");
  const ef = expenses.getByRole("form", { name: "Gider kayıt formu" });
  await ef
    .getByRole("combobox", { name: "Kategori", exact: true })
    .selectOption("TRANSPORT");
  await ef.getByLabel("Açıklama", { exact: true }).fill("K5 nakliye gideri");
  await ef.getByLabel("Belge referansı").fill("K5-BROWSER-500");
  await ef.getByLabel("Gider tarihi").fill("26.10.2026");
  await ef.getByLabel("Net gider (TL)").fill("500,00");
  await ef.getByLabel("KDV tutarı (TL)").fill("0,00");
  await ef.getByLabel("Ödeme hesabı").selectOption(cash);
  const expenseResponse = page.waitForResponse(
    (r) =>
      r.url().includes("/finance/expenses") && r.request().method() === "POST",
  );
  await ef.getByRole("button", { name: "Gideri kaydet", exact: true }).click();
  expect((await expenseResponse).status()).toBe(200);
  const card = (label: string) =>
    expenses
      .locator("dl > div")
      .filter({ has: page.getByText(label, { exact: true }) });
  await expect(card("Kasa bakiyesi")).toContainText("1.500,00 TL");
  await expect(card("Brüt satış")).toContainText("4.800,00 TL");
  await row.getByRole("button", { name: "Tahsilat al", exact: true }).click();
  form = panel.getByRole("form", { name: "Tahsilat ödeme formu" });
  await form.getByLabel("Tutar (TL)", { exact: true }).fill("2.800,00");
  await form.getByLabel("İşlem tarihi").fill("26.10.2026");
  await form.getByLabel("Para hesabı").selectOption(cash);
  await form
    .getByRole("button", { name: "Tahsilatı kaydet", exact: true })
    .click();
  await expect(
    row.getByRole("button", { name: "Tahsilat al", exact: true }),
  ).toBeDisabled();
  await expect(card("Kasa bakiyesi")).toContainText("4.300,00 TL");
  await page.context().setOffline(true);
  await panel.getByRole("button", { name: "Finans verilerini yenile" }).click();
  await expect(panel.getByRole("alert").first()).toBeVisible();
  await page.context().setOffline(false);
  await panel.getByRole("button", { name: "Finans verilerini yenile" }).click();
  await expect(row).toContainText("0,00 TL");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  const reopened = await page.context().newPage();
  await page.close();
  await reopened.goto("/app");
  await reopened
    .getByRole("button", { name: "Cari ve Finans", exact: true })
    .click();
  const reopenedPanel = reopened.getByRole("region", {
    name: "Finans çalışma alanı",
  });
  await expect(
    reopenedPanel
      .locator("tr")
      .filter({ hasText: sale.id })
      .getByRole("button", { name: "Tahsilat al", exact: true }),
  ).toBeDisabled();
  await expect(
    reopenedPanel.locator("tr").filter({ hasText: "K5 acceptance cash" }),
  ).toContainText("4.300,00 TL");
  expect(
    await reopened.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
