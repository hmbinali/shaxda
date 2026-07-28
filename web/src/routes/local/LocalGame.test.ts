import { deserialize, serialize } from "@shaxda/game-engine";
import { messages } from "@shaxda/i18n";
import { gameFixtures } from "@shaxda/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOUND_PREFERENCE_STORAGE_KEY } from "$lib/audio/sound";
import { LOCAL_GAME_STORAGE_KEY } from "$lib/game/localGameStorage";

vi.mock("$lib/site/metadata", () => ({
  absoluteUrl: (path: string) => `https://shaxda.example${path}`,
  ogImagePath: "/og-image.png",
}));

import LocalGamePage from "./+page.svelte";

const copy = messages.so.localGame;

describe("/local", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("places a piece and persists the unfinished game", async () => {
    const { container } = render(LocalGamePage);

    expect(screen.getByTestId("tabletop")).toHaveAttribute(
      "data-testid",
      "tabletop",
    );
    expect(screen.getByTestId("player-rail-B")).toHaveAttribute(
      "data-rotated",
      "true",
    );
    expect(screen.getByTestId("player-rail-A")).toHaveAttribute(
      "data-rotated",
      "false",
    );
    expect(screen.getByTestId("player-rail-A")).toHaveAttribute(
      "data-rail-state",
      "acting",
    );

    await fireEvent.click(point(container, "O1"));

    expect(point(container, "O1")).toHaveAttribute("data-occupant", "A");
    expect(screen.getByTestId("player-rail-B")).toHaveAttribute(
      "data-rail-state",
      "acting",
    );
    const saved = window.localStorage.getItem(LOCAL_GAME_STORAGE_KEY);
    expect(saved).not.toBeNull();
    expect(deserialize(saved ?? "").board.O1).toBe("A");
    expect(screen.getByTestId("game-announcer")).toHaveTextContent(
      `${copy.playerNames.A} ${copy.announce.placed} O1`,
    );
  });

  it("announces the first jare formed during placement", async () => {
    const { container } = render(LocalGamePage);

    for (const pointId of ["O1", "M1", "O2", "M3", "O3"]) {
      await fireEvent.click(point(container, pointId));
    }

    expect(screen.getByTestId("game-announcer")).toHaveTextContent(
      `${copy.playerNames.A} ${copy.announce.placed} O3. ${copy.announce.jareFormed}.`,
    );
  });

  it("shows invalid feedback for illegal taps", async () => {
    const { container } = render(LocalGamePage);

    await fireEvent.click(point(container, "O1"));
    await fireEvent.click(point(container, "O1"));

    expect(screen.getByTestId("invalid-feedback")).toHaveTextContent(
      copy.invalid.illegalPoint,
    );
  });

  it("renders and persists the sound toggle state", async () => {
    render(LocalGamePage);

    const muteButton = screen.getAllByRole("button", {
      name: copy.controls.soundOff,
    })[0];
    expect(muteButton).toHaveAttribute("aria-pressed", "true");

    await fireEvent.click(muteButton);

    expect(window.localStorage.getItem(SOUND_PREFERENCE_STORAGE_KEY)).toBe(
      "false",
    );
    expect(
      screen.getAllByRole("button", { name: copy.controls.soundOn })[0],
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("loads the persisted muted state", async () => {
    window.localStorage.setItem(SOUND_PREFERENCE_STORAGE_KEY, "false");

    render(LocalGamePage);

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: copy.controls.soundOn })[0],
      ).toHaveAttribute("aria-pressed", "false"),
    );
  });

  it("resigns and displays the game-over result", async () => {
    render(LocalGamePage);

    await fireEvent.click(
      screen.getByRole("button", { name: copy.controls.resign }),
    );
    await fireEvent.click(
      screen.getByRole("button", { name: copy.tabletop.confirm }),
    );

    expect(screen.getByTestId("game-result")).toHaveTextContent(
      `${copy.result.winnerLabel}: ${copy.playerNames.B}`,
    );
    expect(screen.getByTestId("game-result")).toHaveTextContent(
      copy.result.reasons.resignation,
    );
  });

  it("starts a new game after confirmation and clears saved state", async () => {
    const { container } = render(LocalGamePage);

    await fireEvent.click(point(container, "O1"));
    await fireEvent.click(
      screen.getAllByRole("button", { name: copy.controls.newGame })[0],
    );
    expect(
      screen.getByRole("dialog", { name: copy.controls.newGame }),
    ).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole("button", { name: copy.tabletop.confirm }),
    );

    expect(point(container, "O1")).toHaveAttribute("data-occupant", "empty");
    expect(window.localStorage.getItem(LOCAL_GAME_STORAGE_KEY)).toBeNull();
  });

  it("resumes an unfinished saved game", () => {
    window.localStorage.setItem(
      LOCAL_GAME_STORAGE_KEY,
      serialize(gameFixtures.movement),
    );

    const { container } = render(LocalGamePage);

    expect(point(container, "O8")).toHaveAttribute("data-occupant", "B");
    expect(screen.getAllByText(copy.phases.movement)[0]).toBeInTheDocument();
  });
});

function point(container: HTMLElement, id: string): Element {
  const element = container.querySelector(`[data-point-id="${id}"]`);

  expect(element).not.toBeNull();

  return element as Element;
}
