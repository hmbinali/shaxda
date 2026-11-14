import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, expect, it, vi } from "vitest";
import MatchRatingResult from "./MatchRatingResult.svelte";

const id = "A".repeat(20);
const save = { matchNumber: 1, matchId: id, status: "saved" as const };
const pending = {
  status: "pending",
  reason: null,
  seats: null,
  updating: false,
  corrected: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("polls a saved rated match and displays the confirmed whole-number deltas", async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(pending)))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...pending,
          status: "processed",
          seats: {
            A: { before: 1500, after: 1662, delta: 162, provisional: true },
            B: { before: 1500, after: 1338, delta: -162, provisional: true },
          },
        }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  render(MatchRatingResult, { rated: true, save, matchNumber: 1 });
  expect(screen.getByTestId("match-rating-pending")).toBeVisible();
  await vi.advanceTimersByTimeAsync(2_000);
  await tick();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0]?.[0]).toBe(`/api/matches/${id}/rating`);
  expect(screen.getByTestId("match-rating-confirmed")).toHaveTextContent(
    "+162",
  );
  expect(screen.getByTestId("match-rating-confirmed")).toHaveTextContent(
    "−162",
  );
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("caps polling, cancels on rematch, and avoids friendly or stalled requests", async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(pending))),
    );
  vi.stubGlobal("fetch", fetch);
  const mounted = render(MatchRatingResult, {
    rated: true,
    save,
    matchNumber: 1,
  });
  await vi.advanceTimersByTimeAsync(40_000);
  expect(fetch).toHaveBeenCalledTimes(6);
  await mounted.rerender({
    rated: true,
    save: { ...save, matchNumber: 2 },
    matchNumber: 2,
  });
  await vi.advanceTimersByTimeAsync(1_000);
  expect(fetch).toHaveBeenCalledTimes(7);
  await mounted.rerender({ rated: false, save: null, matchNumber: 3 });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(7);
  expect(screen.queryByTestId("match-rating-pending")).toBeNull();
  await mounted.rerender({
    rated: true,
    save: { status: "stalled", matchNumber: 3 },
    matchNumber: 3,
  });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(7);
  expect(screen.queryByTestId("match-rating-pending")).toBeNull();
});
