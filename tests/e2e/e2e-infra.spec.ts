import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  repoRoot,
  resolveE2eStatePath,
  testResultsRoot,
} from "../../scripts/lib/e2e-state.mjs";
import { fingerprintTree, listFiles } from "../../scripts/lib/fs-tree.mjs";

const workerE2eState = resolveE2eStatePath("wrangler-e2e");
const webE2eState = resolveE2eStatePath("wrangler-web-e2e");

type Baseline = {
  path: string;
  exists: boolean;
  files: number;
  digest: string | null;
};

function readBaseline(name: string): Baseline {
  return JSON.parse(readFileSync(join(testResultsRoot, name), "utf8"));
}

/**
 * Miniflare writes Durable Object storage lazily, so poll rather than assume the
 * files have landed by the time the room is on screen.
 */
async function waitForPersistence(state: string): Promise<string[]> {
  const deadline = Date.now() + 10_000;
  let files = listFiles(state);

  while (files.length === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    files = listFiles(state);
  }

  return files;
}

test.describe("E2E infrastructure", () => {
  test("persists Durable Object state only under the dedicated test directory", async ({
    page,
  }) => {
    // Playwright used to pass `--persist-to` after a stray `--`, so Wrangler
    // never parsed it and state piled up in `worker/.wrangler/state` instead.
    const baselines = [
      readBaseline("dev-state-baseline.worker.json"),
      readBaseline("dev-state-baseline.web.json"),
    ];

    await page.goto("/online");
    await page.getByLabel("Magaca martida").fill("Ayaan");
    await page.getByTestId("create-room").click();
    await expect(page.getByTestId("online-lobby")).toContainText(
      "Sug ciyaaryahanka kale.",
    );

    const workerFiles = await waitForPersistence(workerE2eState);
    expect(
      workerFiles.join("\n"),
      `expected Durable Object state under ${workerE2eState}`,
    ).toContain("do/");

    expect(listFiles(webE2eState).length).toBeGreaterThan(0);

    // A developer's own Wrangler state may legitimately pre-exist, so require it
    // to be unchanged rather than absent.
    for (const baseline of baselines) {
      expect(
        fingerprintTree(baseline.path),
        `${baseline.path} changed during the E2E run`,
      ).toEqual({
        exists: baseline.exists,
        files: baseline.files,
        digest: baseline.digest,
      });
    }
  });

  test("refuses to clean anything outside test-results", () => {
    for (const name of ["", "..", "../..", "../web", "/tmp/shaxda", repoRoot]) {
      expect(
        () => resolveE2eStatePath(name),
        `${name || "<empty>"} should be rejected`,
      ).toThrow();
    }

    expect(resolveE2eStatePath("wrangler-e2e")).toBe(workerE2eState);
  });
});
