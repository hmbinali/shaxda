import { isHttpError, isRedirect } from "@sveltejs/kit";
import { render, screen, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "./+page.server";
import Stats from "./+page.svelte";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@shaxda/db/analytics", () => ({ readAnalyticsStats: read }));

const now = Date.parse("2026-11-14T02:15:00Z");
const syntheticData = {
  daily: [
    { day: "2026-11-13", event: "active_browsers_1d", count: 4 },
    { day: "2026-11-13", event: "local_started", count: 4 },
    { day: "2026-11-13", event: "local_completed", count: 3 },
  ],
  today: { guest: 2, account: 1 },
  recordedSince: {
    active_browsers_1d: "2026-11-13",
    local_started: "2026-11-13",
    local_completed: "2026-11-13",
  },
  lastSuccessAt: now,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now);
  read.mockResolvedValue(syntheticData);
});

function args(id: string | null) {
  const setHeaders = vi.fn();
  return {
    setHeaders,
    locals: { user: id === null ? null : { id } },
    platform: { env: { DB: {}, ADMIN_USER_IDS: "one,admin,other" } },
    url: new URL("https://shaxda.example/admin/stats"),
  } as unknown as Parameters<typeof load>[0];
}

describe("admin stats", () => {
  it("redirects signed-out users and rejects non-exact IDs", async () => {
    const redirected = await Promise.resolve()
      .then(() => load(args(null)))
      .catch((error) => error);
    expect(isRedirect(redirected)).toBe(true);
    expect(redirected).toMatchObject({
      status: 303,
      location: "/login?returnTo=%2Fadmin%2Fstats",
    });
    const forbidden = await Promise.resolve()
      .then(() => load(args("ad")))
      .catch((error) => error);
    expect(isHttpError(forbidden, 403)).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  it("returns only aggregate data with private cache and indexing headers", async () => {
    const request = args("admin");
    const data = await load(request);
    expect(request.setHeaders).toHaveBeenCalledWith({
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    });
    expect(data).toMatchObject({ daily: syntheticData.daily });
    expect(read).toHaveBeenCalledExactlyOnceWith(
      request.platform?.env.DB,
      "2026-09-21",
      "2026-11-14",
      expect.arrayContaining([
        "online_room_joined_account",
        "online_completed_quick_guest",
      ]),
    );
  });

  it("includes raw counts with percentages and marks unavailable blocks", async () => {
    const data = await load(args("admin"));
    render(Stats, { data: { ...data, account: null } });
    expect(screen.getAllByText(/75\s?% \(3 \/ 4\)/)).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Ciyaaraha khadka" }),
    ).toBeVisible();
    expect(
      screen.getAllByText("Weli lama diiwaangelin.").length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("shows online totals by event, mode, and kind from the first recorded day", async () => {
    const invite = "online_started_invite_guest";
    const quick = "online_completed_quick_account";
    read.mockResolvedValue({
      ...syntheticData,
      daily: [
        ...syntheticData.daily,
        { day: "2026-11-13", event: invite, count: 4 },
        { day: "2026-11-14", event: quick, count: 3 },
      ],
      recordedSince: {
        ...syntheticData.recordedSince,
        [invite]: "2026-11-13",
        [quick]: "2026-11-14",
      },
    });
    const data = await load(args("admin"));
    render(Stats, { data: { ...data, account: null } });
    const invites = within(
      screen.getByRole("table", { name: "Ciyaaraha martiqaadka" }),
    );
    expect(
      invites.getByRole("row", { name: "2026-11-13 4 0 0 0" }),
    ).toBeVisible();
    expect(
      invites.getByRole("row", { name: "2026-11-12 — — — —" }),
    ).toBeVisible();
    const quickGames = within(
      screen.getByRole("table", { name: "Ciyaar-helidda degdegga ah" }),
    );
    expect(
      quickGames.getByRole("row", { name: "2026-11-14 0 0 0 3" }),
    ).toBeVisible();
  });
});

it("renders eight weeks and mature cohort dates with raw denominators", async () => {
  read.mockResolvedValue({
    ...syntheticData,
    daily: [
      ...syntheticData.daily,
      { day: "2026-09-21", event: "week_players", count: 8 },
      { day: "2026-09-21", event: "week_returning", count: 2 },
      { day: "2026-11-09", event: "week_players", count: 3 },
      { day: "2026-11-06", event: "cohort_size", count: 4 },
      { day: "2026-11-06", event: "cohort_d7", count: 2 },
      { day: "2026-10-07", event: "cohort_size", count: 3 },
      { day: "2026-10-07", event: "cohort_d30", count: 0 },
      { day: "2026-11-13", event: "cohort_size", count: 1 },
      { day: "2026-11-13", event: "saved_friendly", count: 5 },
    ],
    recordedSince: { ...syntheticData.recordedSince, cohort_d30: "2026-10-07" },
  });
  const data = await load(args("admin"));
  render(Stats, { data: { ...data, account: null } });

  const weeks = within(
    screen.getByRole("table", {
      name: "Ciyaartoyda soo laabatay toddobaadka xiga",
    }),
  );
  expect(weeks.getAllByRole("row")).toHaveLength(9);
  expect(weeks.getByText(/25\s?% \(2 \/ 8\)/)).toBeVisible();
  const open = within(weeks.getByRole("row", { name: /2026-11-09/ }));
  expect(open.getByText("Weli ma dhammaystirna")).toBeVisible();
  expect(
    screen.getByText("Ha go'aamin ka hor laba toddobaad oo dhammaystiran."),
  ).toBeVisible();
  const d7 = within(screen.getByRole("table", { name: "Maalinta 7aad" }));
  expect(d7.getByText(/50\s?% \(2 \/ 4\)/)).toBeVisible();
  expect(d7.getByText("Weli ma dhammaystirna")).toBeVisible();
  const d30 = within(screen.getByRole("table", { name: "Maalinta 30aad" }));
  expect(d30.getByText(/0\s?% \(0 \/ 3\)/)).toBeVisible();
  expect(d30.getByText("Weli ma dhammaystirna")).toBeVisible();
  expect(
    screen.getByText("La diiwaangeliyey laga bilaabo 2026-10-07"),
  ).toBeVisible();
});
