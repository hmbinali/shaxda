import { render } from "@testing-library/svelte";
import { gameFixtures } from "@shaxda/shared";
import { describe, expect, it } from "vitest";
import Board from "./Board.svelte";

describe("Board", () => {
  it("renders one socket per point and pieces from fixture occupancy", () => {
    const { container } = render(Board, {
      props: { state: gameFixtures.midPlacement },
    });

    expect(
      container.querySelectorAll('[data-testid="board-socket"]'),
    ).toHaveLength(24);
    expect(
      container.querySelectorAll('[data-testid="board-piece"]'),
    ).toHaveLength(4);
    expect(point(container, "O1")).toHaveAttribute("data-occupant", "A");
    expect(point(container, "M1")).toHaveAttribute("data-occupant", "B");
  });

  it("renders selected and legal-hint states for a movement fixture", () => {
    const { container } = render(Board, {
      props: { state: gameFixtures.movement, selected: "O8" },
    });

    expect(point(container, "O8")).toHaveAttribute("data-selected", "true");
    expect(point(container, "O1")).toHaveAttribute("data-legal-hint", "true");
    expect(
      container.querySelectorAll('[data-testid="board-selected-ring"]'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="board-legal-hint"]'),
    ).toHaveLength(1);
  });

  it("renders capture target state for a pending capture fixture", () => {
    const { container } = render(Board, {
      props: { state: gameFixtures.capturePending },
    });

    expect(point(container, "O5")).toHaveAttribute(
      "data-capture-target",
      "true",
    );
    expect(
      container.querySelectorAll('[data-testid="board-capture-target"]'),
    ).toHaveLength(3);
  });
});

function point(container: HTMLElement, id: string): Element {
  const element = container.querySelector(`[data-point-id="${id}"]`);

  expect(element).not.toBeNull();

  return element as Element;
}
