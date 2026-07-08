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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @shaxda/worker dev -- --ip 127.0.0.1 --port 8787",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://127.0.0.1:8787/health",
    },
    {
      command: "pnpm --filter @shaxda/web preview --host 127.0.0.1 --port 4173",
      reuseExistingServer: !process.env.CI,
      url: "http://127.0.0.1:4173",
    },
  ],
});
