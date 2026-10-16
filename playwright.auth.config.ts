import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/auth-e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    launchOptions: { timeout: 30000 },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npx tsx scripts/auth/start-test-server.ts",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
