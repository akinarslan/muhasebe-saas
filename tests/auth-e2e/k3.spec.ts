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

test("K3 actual local cash collection supplier payment and POS settlement UI", async ({
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
  const op = async (kind: string, path: string, extra: object) =>
    post("finance/" + path, {
      intentId: await intent(kind),
      idempotencyKey: randomUUID(),
      currency: "TRY",
      amount: "0",
      fee: "0",
      bookedOn: "2026-10-22",
      reason: "K3 browser fixture",
      ...extra,
    });
  const cash = (
      await post("finance/funds", { kind: "CASH", label: "Fixture kasa" })
    ).id,
    bank = (
      await post("finance/funds", { kind: "BANK", label: "Fixture banka" })
    ).id,
    pos = (await post("finance/funds", { kind: "POS", label: "Fixture POS" }))
      .id;
  await op("OPEN", "fund-opening", {
    fundAccountId: bank,
    amount: "10000",
    bookedOn: "2026-10-01",
  });
  const customer = await post("customers", {
      idempotencyKey: randomUUID(),
      name: "K3 browser customer",
    }),
    product = await post("products", {
      idempotencyKey: randomUUID(),
      name: "K3 browser service",
      kind: "service",
      unit: "adet",
    });
  const rateRes = await page.request.post("/api/cloud/exchange-rate", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { usdTry: "40", reason: "K3 browser synthetic rate" },
  });
  expect(rateRes.status()).toBe(201);
  const rate = await rateRes.json();
  const saleData = {
    customerId: customer.id,
    date: "2026-10-22",
    dueDate: "2026-10-29",
    currency: "TRY",
    notes: "K3 browser sale",
    rate: { kind: "manual", id: rate.id },
    plans: [],
    lines: [
      {
        productId: product.id,
        description: "Service",
        quantity: 1,
        widthCm: 0,
        heightCm: 0,
        discount: 0,
        vat: 20,
        zeroCostConfirmed: true,
        costing: {
          materials: [],
          expenses: [],
          method: "margin",
          targetPercent: 50,
          manualNetUsd: 250,
          vat: 20,
        },
      },
    ],
  };
  const sale = await post("sales", {
    ...saleData,
    idempotencyKey: randomUUID(),
    sourceRef: `intent:${await intent("SALE")}`,
  });
  const supplier = await post("suppliers", {
      idempotencyKey: randomUUID(),
      name: "K3 browser supplier",
      defaultCurrency: "TRY",
      leadTimeDays: 0,
    }),
    ap = await post("finance/accounts", {
      kind: "SUPPLIER",
      partyId: supplier.id,
    });
  const debt = await op("DEBT", "debt", {
    accountId: ap.id,
    amount: "8000",
    dueOn: "2026-10-29",
    externalRef: "BROWSER-INVOICE",
  });
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Cari ve Finans", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Finans çalışma alanı" });
  await expect(panel).toBeVisible();
  const saleRow = panel.locator("tr").filter({ hasText: sale.id });
  await expect(saleRow).toContainText("12.000,00 TL");
  await saleRow
    .getByRole("button", { name: "Tahsilat al", exact: true })
    .click();
  let form = panel.getByRole("form", { name: "Tahsilat ödeme formu" });
  await form.getByLabel("Tutar (TL)", { exact: true }).fill("5.000,00");
  await form.getByLabel("İşlem tarihi").fill("22.10.2026");
  await form.getByLabel("Para hesabı").selectOption(cash);
  await form
    .getByRole("button", { name: "Tahsilatı kaydet", exact: true })
    .click();
  await expect(saleRow).toContainText("7.000,00 TL");
  await saleRow
    .getByRole("button", { name: "Tahsilat al", exact: true })
    .click();
  form = panel.getByRole("form", { name: "Tahsilat ödeme formu" });
  await form.getByLabel("Tutar (TL)", { exact: true }).fill("7.000,00");
  await form.getByLabel("İşlem tarihi").fill("22.10.2026");
  await form.getByLabel("Yöntem").selectOption("BANK");
  await form.getByLabel("Para hesabı").selectOption(bank);
  await form.getByLabel("Terminal / banka referansı").fill("BROWSER-EFT");
  await form
    .getByRole("button", { name: "Tahsilatı kaydet", exact: true })
    .click();
  await expect(
    saleRow.getByRole("button", { name: "Tahsilat al", exact: true }),
  ).toBeDisabled();
  const payRow = panel.locator("tr").filter({
    has: page.getByRole("button", { name: "Ödeme yap", exact: true }),
  });
  await payRow.getByRole("button", { name: "Ödeme yap", exact: true }).click();
  form = panel.getByRole("form", { name: "Tahsilat ödeme formu" });
  await form.getByLabel("Tutar (TL)", { exact: true }).fill("3.000,00");
  await form.getByLabel("İşlem tarihi").fill("22.10.2026");
  await form.getByLabel("Yöntem").selectOption("BANK");
  await form.getByLabel("Para hesabı").selectOption(bank);
  await form.getByLabel("Terminal / banka referansı").fill("BROWSER-PAY");
  await form
    .getByRole("button", { name: "Ödemeyi kaydet", exact: true })
    .click();
  await expect(payRow).toContainText("5.000,00 TL");
  await saleRow
    .getByRole("button", { name: "Cari ekstre", exact: true })
    .click();
  await expect(panel.getByText("Genel cari bakiye:")).toContainText("0,00 TL");
  const second = await post("sales", {
    ...saleData,
    idempotencyKey: randomUUID(),
    sourceRef: `intent:${await intent("SALE")}`,
  });
  const fin = await (
    await page.request.get(
      `/api/cloud/workspace/finance/sales/${second.id}?company=${scope.legalEntityId}`,
    )
  ).json();
  await op("COLLECT", "collect", {
    sourceJournalId: fin.journal.id,
    fundAccountId: pos,
    method: "CARD",
    amount: "1000",
    terminalApproved: true,
    externalRef: "BROWSER-POS-1",
  });
  await panel.getByRole("button", { name: "Finans verilerini yenile" }).click();
  await expect(
    panel.locator("tr").filter({ hasText: "Fixture POS" }),
  ).toContainText("1.000,00 TL");
  await panel
    .getByLabel("POS tahsilat journal referansı")
    .selectOption({ label: "BROWSER-POS-1 — 1.000,00 TL" });
  await panel.getByLabel("Settlement banka hesabı").selectOption(bank);
  await panel.getByLabel("Settlement brüt").fill("1.000,00");
  await panel.getByLabel("Komisyon", { exact: true }).fill("20,00");
  await panel.getByLabel("Settlement tarihi").fill("22.10.2026");
  await panel.getByLabel("Banka settlement referansı").fill("BROWSER-SETTLE");
  await panel
    .getByRole("button", { name: "Settlement kaydet", exact: true })
    .click();
  await expect(
    panel.locator("tr").filter({ hasText: "Fixture banka" }),
  ).toContainText("14.980,00 TL");
  await expect(
    panel.locator("tr").filter({ hasText: "Fixture POS" }),
  ).toContainText("0,00 TL");
  expect(debt.id).toBeTruthy();
});
