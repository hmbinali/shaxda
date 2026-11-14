import { fireEvent, render } from "@testing-library/svelte";
import { parseStoredReplay } from "@shaxda/shared";
import { sampleMatchPayloads } from "@shaxda/shared/match-fixtures";
import { createRawSnippet } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MatchReplay from "./MatchReplay.svelte";

const mocks = vi.hoisted(() => ({
  replaceState: vi.fn((url: URL, state: unknown) =>
    history.replaceState(state, "", url),
  ),
  afterNavigate: vi.fn(),
  beforeNavigate: vi.fn(),
  play: vi.fn(),
  unlock: vi.fn(),
}));

vi.mock("$app/navigation", () => ({
  replaceState: mocks.replaceState,
  beforeNavigate: mocks.beforeNavigate,
  afterNavigate: mocks.afterNavigate,
}));
vi.mock("$app/state", () => ({ page: { state: {} } }));
vi.mock("$lib/audio/sound", () => ({
  getSoundPlayer: () => ({ play: mocks.play, unlock: mocks.unlock }),
}));

function viewer(match = sampleMatchPayloads.M2) {
  const { getByRole, getByTestId, queryByTestId, unmount } = render(
    MatchReplay,
    {
      props: {
        matchId: match.id,
        replay: {
          kind: "ready",
          rulesV: match.rulesV,
          replayV: match.replayV,
          replay: parseStoredReplay(match.replay),
        },
        facts: {
          ...match,
          players: { A: match.players[0], B: match.players[1] },
        },
        names: { A: "@ayaan", B: "Xubin la tirtiray" },
        headline: match.winnerSeat === null ? "Barbaro" : "Guuleystay",
        reason: match.onlineEndReason
          ? "@ayaan wuu hakaday."
          : "Ciyaartu way dhammaatay.",
        onlineEndReason: match.onlineEndReason,
        share: createRawSnippet(() => ({ render: () => "<span></span>" })),
      },
    },
  );
  return {
    button: (name: string) => getByRole("button", { name }),
    counter: getByTestId("replay-counter"),
    description: getByTestId("replay-description"),
    speed: getByRole("combobox", { name: "Xawaare" }),
    result: () => queryByTestId("replay-result"),
    unmount,
  };
}

describe("match replay controls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    history.replaceState({}, "", "/match/id");
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("waits one interval, changes speed, pauses and restarts from the end", async () => {
    const ui = viewer();
    expect(ui.counter).toHaveTextContent("0 / 4");
    expect(ui.button("Tallaabadii hore")).toBeDisabled();
    await fireEvent.click(ui.button("Ciyaar"));
    await vi.advanceTimersByTimeAsync(999);
    expect(ui.counter).toHaveTextContent("0 / 4");
    await vi.advanceTimersByTimeAsync(1);
    expect(ui.counter).toHaveTextContent("1 / 4");
    await fireEvent.change(ui.speed, { target: { value: "0.5" } });
    await vi.advanceTimersByTimeAsync(1999);
    expect(ui.counter).toHaveTextContent("1 / 4");
    await vi.advanceTimersByTimeAsync(1);
    expect(ui.counter).toHaveTextContent("2 / 4");
    await fireEvent.click(ui.button("Hakad"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(ui.counter).toHaveTextContent("2 / 4");
    await fireEvent.click(ui.button("Dhammaadka"));
    expect(ui.result()).toBeVisible();
    expect(ui.button("Tallaabada xigta")).toBeDisabled();
    await fireEvent.change(ui.speed, { target: { value: "2" } });
    await fireEvent.click(ui.button("Ciyaar"));
    expect(ui.result()).toBeNull();
    expect(ui.counter).toHaveTextContent("0 / 4");
    await vi.advanceTimersByTimeAsync(499);
    expect(ui.counter).toHaveTextContent("0 / 4");
    await vi.advanceTimersByTimeAsync(1);
    expect(ui.counter).toHaveTextContent("1 / 4");
  });

  it("debounces the address, syncs on navigation and pauses on hiding", async () => {
    history.replaceState({}, "", "/match/id?a=0002");
    const ui = viewer();
    expect(ui.counter).toHaveTextContent("2 / 4");
    await fireEvent.click(ui.button("Tallaabadii hore"));
    await vi.advanceTimersByTimeAsync(299);
    expect(mocks.replaceState).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.replaceState).toHaveBeenCalledTimes(1);
    expect(location.search).toBe("?a=1");

    await fireEvent.click(ui.button("Ciyaar"));
    await fireEvent.click(ui.button("Hakad"));
    await fireEvent.click(ui.button("Ciyaar"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(ui.counter).toHaveTextContent("2 / 4");
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await fireEvent(document, new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(ui.counter).toHaveTextContent("2 / 4");
    expect(ui.button("Ciyaar")).toBeVisible();

    history.replaceState({}, "", "/match/id?a=4");
    mocks.afterNavigate.mock.calls[0]![0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(ui.counter).toHaveTextContent("4 / 4");
    await fireEvent.click(ui.button("Ciyaar"));
    ui.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts silent and plays cues only on forward playback and Next", async () => {
    localStorage.setItem("shaxda:sound-enabled:v1", "true");
    const ui = viewer();
    expect(ui.button("Codka shid")).toHaveAttribute("aria-pressed", "false");
    await fireEvent.click(ui.button("Tallaabada xigta"));
    expect(mocks.play).not.toHaveBeenCalled();
    await fireEvent.click(ui.button("Codka shid"));
    expect(mocks.unlock).toHaveBeenCalledOnce();
    await fireEvent.click(ui.button("Tallaabada xigta"));
    expect(mocks.play).toHaveBeenCalledExactlyOnceWith(["place"]);
    await fireEvent.click(ui.button("Tallaabadii hore"));
    await fireEvent.click(ui.button("Dhammaadka"));
    expect(mocks.play).toHaveBeenCalledTimes(1);
    await fireEvent.click(ui.button("Ciyaar"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.play).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("shaxda:sound-enabled:v1")).toBe("true");
  });

  it("shows the neutral seat, the online claim reason, and a draw without a winner", async () => {
    const resigned = viewer();
    await fireEvent.click(resigned.button("Dhammaadka"));
    expect(resigned.description).toHaveTextContent("Xubin la tirtiray");
    resigned.unmount();

    const claimed = viewer(sampleMatchPayloads.M3);
    await fireEvent.click(claimed.button("Dhammaadka"));
    expect(claimed.description).toHaveTextContent("@ayaan wuu hakaday.");
    expect(claimed.description).not.toHaveTextContent("wuu is dhiibay");
    claimed.unmount();

    const drawn = viewer(sampleMatchPayloads.M5);
    await fireEvent.click(drawn.button("Dhammaadka"));
    expect(drawn.result()).toHaveTextContent("Barbaro");
    expect(drawn.result()).not.toHaveTextContent("Guuleystay");
  });
});
