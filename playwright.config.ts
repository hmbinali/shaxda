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
  // Never reuse a running server: the launchers clean the dedicated state
  // directories on startup, and reusing one silently skips that, so rooms
  // accumulate across runs until the per-IP limit rejects new ones. With this
  // off, a second concurrent run fails loudly on the bound port instead of
  // quietly sharing a persistence path.
  webServer: [
    {
      command: "node scripts/start-worker-e2e.mjs",
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:8787/health",
    },
    {
      command: "node scripts/start-web-e2e.mjs",
      reuseExistingServer: false,
      timeout: 180_000,
      url: "http://127.0.0.1:4173",
    },
  ],
});
