import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { gameFixtures } from "@shaxda/shared";
import { buildGameStatus } from "$lib/game/status";
import PlayerPiecesCard from "./PlayerPiecesCard.svelte";
import PlayerRail from "./PlayerRail.svelte";

const avatar = {
  mode: "initial" as const,
  imageUrl: null,
  color: "#332016",
  initial: "A",
};

describe("online player identity cards", () => {
  it("shows an account avatar and username in a rail without an anchor", () => {
    const view = render(PlayerRail, {
      player: "A",
      status: buildGameStatus(gameFixtures.emptyBoard),
      name: "ayaan_7",
      username: "ayaan_7",
      avatar,
      viewer: "A",
      railState: "acting",
      instruction: "place",
    });
    expect(view.getByText("@ayaan_7")).toHaveAttribute("title", "@ayaan_7");
    expect(view.getByLabelText("@ayaan_7")).toBeInTheDocument();
    expect(view.container.querySelector("a")).toBeNull();
  });

  it("links an account username from the lobby pieces card", () => {
    const view = render(PlayerPiecesCard, {
      status: buildGameStatus(gameFixtures.emptyBoard),
      playerName: (player: "A" | "B") => `Player ${player}`,
      playerIdentity: (player: "A" | "B") =>
        player === "A" ? { username: "abcdefghijklmnopqrst", avatar } : null,
    });
    const link = view.getByRole("link", { name: "@abcdefghijklmnopqrst" });
    expect(link).toHaveAttribute("href", "/u/abcdefghijklmnopqrst");
    expect(link).toHaveClass("truncate");
    expect(link).toHaveAttribute("title", "@abcdefghijklmnopqrst");
  });
});
