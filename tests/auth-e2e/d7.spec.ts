import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { Client } from "pg";
import { assertDevelopmentTarget } from "../../src/server/db/target";
loadEnvConfig(process.cwd());
test("D7 customer search normal focus filled visual and filtering", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const fixtures = JSON.parse(
    await symmetricDecrypt({
      key: process.env.AUTH_TEST_SECRET!,
      data: await readFile(".data/auth-browser-fixtures.enc", "utf8"),
    }),
  );
  const f = fixtures[info.project.name];
  assertDevelopmentTarget(process.env.TEST_DIRECT_DATABASE_URL, true, true);
  const db = new Client({
    connectionString: process.env.TEST_DIRECT_DATABASE_URL,
  });
  await db.connect();
  let secret: string;
  try {
    const r = await db.query(
      'SELECT t.secret FROM "AuthTwoFactor" t JOIN "AuthUser" u ON u.id=t."userId" WHERE u.email=$1',
      [f.email],
    );
    if (!r.rows[0])
      throw Error(
        "Run full auth browser workflow to enroll isolated fixture MFA first",
      );
    secret = await symmetricDecrypt({
      key: process.env.AUTH_TEST_SECRET!,
      data: r.rows[0].secret,
    });
  } finally {
    await db.end();
  }
  await page.goto("/login");
  await page.getByLabel("Kurumsal e-posta").fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  const otp = page.getByLabel("TOTP doğrulama kodu");
  await expect(otp).toHaveValue("");
  await expect(otp).toBeFocused();
  await expect(page.getByLabel("Hesap e-postası")).toHaveAttribute(
    "readonly",
    "",
  );
  await otp.fill(await createOTP(secret).totp());
  await page
    .getByRole("button", { name: "Doğrula ve devam et", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  const input = page.getByRole("textbox", { name: "Müşteri ara", exact: true });
  await expect(input).toBeVisible({ timeout: 20000 });
  const field = input.locator("..");
  const baseline = process.env.PUSULA_D7_BASELINE === "1";
  const folder = `docs/design/screenshots/d7/${baseline ? "before" : "after"}`;
  await mkdir(folder, { recursive: true });
  const measurements: unknown[] = [];
  for (const state of ["normal", "focus", "filled"]) {
    if (state === "normal") await input.blur();
    else await input.focus();
    if (state === "filled")
      await input.fill(`Cloud customer ${info.project.name}`);
    await field.scrollIntoViewIfNeeded();
    const box = (await field.boundingBox())!;
    await page.screenshot({
      path: `${folder}/${info.project.name}-${state}.png`,
      clip: {
        x: Math.max(0, box.x - 6),
        y: Math.max(0, box.y - 6),
        width: box.width + 12,
        height: box.height + 12,
      },
    });
    const styles = await input.evaluate((el) => {
      const i = getComputedStyle(el),
        p = getComputedStyle(el.parentElement!);
      return {
        inputBorder: i.borderTopWidth,
        inputOutline: i.outlineStyle,
        inputShadow: i.boxShadow,
        wrapperBorder: p.borderTopWidth,
        wrapperOutline: p.outlineStyle,
        wrapperShadow: p.boxShadow,
        inputWidth: el.getBoundingClientRect().width,
        wrapperWidth: el.parentElement!.getBoundingClientRect().width,
      };
    });
    measurements.push({ state, ...styles });
    if (!baseline) {
      expect(styles.inputBorder).toBe("0px");
      expect(styles.inputOutline).toBe("none");
      expect(styles.inputShadow).toBe("none");
      expect(styles.wrapperBorder).toBe("1px");
      expect(styles.inputWidth).toBeLessThan(styles.wrapperWidth);
      if (state !== "normal") expect(styles.wrapperShadow).not.toBe("none");
    }
  }
  await writeFile(
    `${folder}/${info.project.name}-styles.json`,
    JSON.stringify(measurements, null, 2),
  );
  await expect(page.locator(".cloud-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".cloud-table tbody")).toContainText(
    `Cloud customer ${info.project.name}`,
  );
  await input.fill("D7-no-matching-customer");
  await expect(page.locator(".cloud-table tbody tr")).toHaveCount(0);
  await input.fill("");
  await expect(page.locator(".cloud-table tbody tr")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
