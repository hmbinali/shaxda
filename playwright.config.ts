import { defineConfig, devices } from "@playwright/test";

import { e2eOrigins } from "./scripts/lib/e2e-env.mjs";

const origins = e2eOrigins();

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: "list",
  // The account fixtures seed D1 through a separate `wrangler d1 execute`
  // process while the preview Worker holds the same local SQLite file open.
  // Parallel workers therefore contend for the write lock, and whichever side
  // loses fails with `SQLITE_BUSY` — the Worker surfaces it as a
  // `jsgInternalError` on any page load that touches the session, so the test
  // that fails is arbitrary. Playwright already defaults to one worker under
  // `CI`, which is why this only ever broke local runs; pinning it makes local
  // and CI identical. Costs about 18s on a 69-test suite.
  workers: 1,
  use: {
    baseURL: origins.web,
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
      url: `${origins.worker}/health`,
    },
    {
      command: "node scripts/start-web-e2e.mjs",
      reuseExistingServer: false,
      timeout: 180_000,
      url: origins.web,
    },
  ],
});
