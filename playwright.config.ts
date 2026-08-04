import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile-smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile-smoke\.spec\.ts/,
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: [
    {
      command:
        "rm -rf test-results/wrangler-e2e && pnpm --filter @shaxda/worker dev -- --ip 127.0.0.1 --port 8787 --persist-to ../test-results/wrangler-e2e",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://127.0.0.1:8787/health",
    },
    {
      command: "node scripts/start-web-e2e.mjs",
      reuseExistingServer: !process.env.CI,
      url: "http://127.0.0.1:4173",
    },
  ],
});
