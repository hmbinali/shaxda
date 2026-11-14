import { beforeEach, describe, expect, it, vi } from "vitest";
import { scheduled } from "./scheduled";

const { run, rate } = vi.hoisted(() => ({ run: vi.fn(), rate: vi.fn() }));
vi.mock("@shaxda/db/rating", () => ({ processPendingRatings: rate }));
vi.mock("@shaxda/db/analytics", () => ({
  ANALYTICS_JOB_NAME: "x1.nightly",
  runAnalyticsNightly: run,
}));

const start = Date.parse("2026-11-14T00:15:00Z");
const all = vi.fn();
const bind = vi.fn(() => ({ all }));
const prepare = vi.fn(() => ({ bind }));
const env = { DB: { prepare } } as Parameters<typeof scheduled>[1];

async function tick(now: number, cron = "* * * * *") {
  const pending: Promise<unknown>[] = [];
  scheduled({ scheduledTime: now, cron }, env, {
    waitUntil: (promise) => {
      pending.push(promise);
    },
  });
  await Promise.all(pending);
}

beforeEach(() => {
  vi.clearAllMocks();
  all.mockResolvedValue({ results: [] });
  run.mockResolvedValue(undefined);
  rate.mockResolvedValue(0);
});

describe("scheduled dispatcher", () => {
  it("skips the state read before 00:15 and resumes until success", async () => {
    await tick(start - 60_000);
    expect(prepare).not.toHaveBeenCalled();
    expect(rate).toHaveBeenCalledWith(env.DB);
    await tick(start);
    await tick(start + 60_000);
    expect(run.mock.calls).toEqual([
      [env.DB, start],
      [env.DB, start + 60_000],
    ]);
    all.mockResolvedValue({
      results: [{ name: "x1.nightly", last_success_at: start + 60_000 }],
    });
    await tick(start + 2 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("supports the Wrangler test cron and sanitizes a rejected job", async () => {
    run.mockRejectedValueOnce(Error("raw D1 details"));
    await expect(tick(start - 60_000, "15 0 * * *")).rejects.toThrow(
      /^Scheduled job failed\.$/,
    );
    expect(run).toHaveBeenCalledOnce();
  });
});
