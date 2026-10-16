import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
test("database health exposes status only", async ({ request }) => {
  const response = await request.get("/api/health/database");
  const configured = Boolean(process.env.DATABASE_URL);
  expect(response.status()).toBe(configured ? 200 : 503);
  expect(await response.json()).toEqual({
    status: configured ? "ok" : "unavailable",
  });
  expect(response.headers()["cache-control"]).toBe("no-store");
});
