import { fireEvent, render } from "@testing-library/svelte";
import { gameFixtures } from "@shaxda/shared";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
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
    expect(
      screenClass(container, '[data-testid="board-selected-ring"]'),
    ).toContain("shaxda-selected-glow");
    expect(
      screenClass(container, '[data-testid="board-legal-hint"]'),
    ).toContain("shaxda-valid-pulse");
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

  it("renders wooden board layers and completed jare highlights", () => {
    const { container } = render(Board, {
      props: { state: gameFixtures.placementJare },
    });

    expect(
      container.querySelector('[data-testid="board-wood-surface"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="board-wood-grain"]'),
    ).toBeInTheDocument();

    const jareLine = container.querySelector(
      '[data-testid="board-jare-line"][data-jare-line-id="O1-O2-O3"]',
    );

    expect(jareLine).not.toBeNull();
    expect(jareLine).toHaveAttribute("data-owner", "A");
    expect(jareLine).toHaveClass("shaxda-jare-line");
  });

  it("renders the active pending-capture jare line", () => {
    const { container } = render(Board, {
      props: { state: gameFixtures.capturePending },
    });

    const activeLine = container.querySelector(
      '[data-testid="board-jare-line"][data-active-pending-capture="true"]',
    );

    expect(activeLine).not.toBeNull();
    expect(activeLine).toHaveAttribute("data-jare-line-id", "O1-O2-O3");
    expect(activeLine).toHaveClass("shaxda-jare-line-active");
  });

  it("renders movement, capture, and invalid animation markers from feedback", () => {
    const { container, rerender } = render(Board, {
      props: {
        state: gameFixtures.movement,
        lastAction: {
          action: { type: "move", player: "B", from: "O8", to: "O1" },
          nonce: 7,
        },
        invalidNonce: 2,
      },
    });

    const moveAnimation = container.querySelector(
      '[data-testid="board-move-animation"]',
    );

    expect(container.querySelector('[data-testid="board"]')).toHaveAttribute(
      "data-invalid-shake",
      "2",
    );
    expect(moveAnimation).toHaveAttribute("data-feedback-nonce", "7");
    expect(moveAnimation).toHaveClass("shaxda-move-ghost");
    expect(moveAnimation).toHaveAttribute(
      "style",
      expect.stringContaining("--move-x:"),
    );
    expect(moveAnimation).toHaveAttribute("pointer-events", "none");

    rerender({
      state: gameFixtures.capturePending,
      lastAction: {
        action: { type: "capture", player: "A", point: "O5" },
        nonce: 8,
      },
      invalidNonce: 0,
    });

    const captureBurst = container.querySelector(
      '[data-testid="board-capture-burst"]',
    );

    expect(captureBurst).toHaveAttribute("data-feedback-nonce", "8");
    expect(captureBurst).toHaveClass("shaxda-capture-burst");
    expect(captureBurst).toHaveAttribute("pointer-events", "none");
  });

  it("remounts nonce-driven animation elements so CSS can replay", async () => {
    const { container, rerender } = render(Board, {
      props: {
        state: gameFixtures.movement,
        lastAction: {
          action: { type: "move", player: "B", from: "O8", to: "O1" },
          nonce: 7,
        },
        invalidNonce: 1,
      },
    });

    const initialSvg = boardSvg(container);
    const initialMoveAnimation = moveAnimation(container);

    await rerender({
      state: gameFixtures.movement,
      lastAction: {
        action: { type: "move", player: "B", from: "O1", to: "O8" },
        nonce: 8,
      },
      invalidNonce: 1,
    });

    expect(moveAnimation(container)).not.toBe(initialMoveAnimation);
    expect(boardSvg(container)).toBe(initialSvg);

    await rerender({
      state: gameFixtures.movement,
      lastAction: {
        action: { type: "move", player: "B", from: "O8", to: "O1" },
        nonce: 9,
      },
      invalidNonce: 2,
    });

    expect(boardSvg(container)).not.toBe(initialSvg);
  });

  it("keeps static board points non-interactive by default", () => {
    const { container } = render(Board, {
      props: { state: gameFixtures.emptyBoard },
    });

    expect(point(container, "O1")).not.toHaveAttribute("role");
    expect(point(container, "O1")).not.toHaveAttribute("tabindex");
  });

  it("calls point callbacks for interactive clicks and keyboard activation", async () => {
    const onSelectPoint = vi.fn();
    const { container } = render(Board, {
      props: {
        state: gameFixtures.emptyBoard,
        interactive: true,
        onSelectPoint,
      },
    });

    await fireEvent.click(point(container, "O1"));
    await fireEvent.keyDown(point(container, "O2"), { key: "Enter" });
    await fireEvent.keyDown(point(container, "O3"), { key: " " });
    await fireEvent.keyDown(point(container, "O4"), { key: "Escape" });

    expect(point(container, "O1")).toHaveAttribute("role", "button");
    expect(point(container, "O1")).toHaveAttribute("tabindex", "0");
    expect(onSelectPoint).toHaveBeenCalledTimes(3);
    expect(onSelectPoint).toHaveBeenNthCalledWith(1, "O1");
    expect(onSelectPoint).toHaveBeenNthCalledWith(2, "O2");
    expect(onSelectPoint).toHaveBeenNthCalledWith(3, "O3");
  });

  it("defines reduced-motion CSS that disables animated L2 effects", () => {
    const css = readFileSync("src/app.css", "utf8");
    const reducedMotionBlock = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)"),
    );

    expect(reducedMotionBlock).toContain(".shaxda-valid-pulse");
    expect(reducedMotionBlock).toContain(".shaxda-move-ghost");
    expect(reducedMotionBlock).toContain(".shaxda-capture-burst");
    expect(reducedMotionBlock).toContain(
      "[data-invalid-shake] .shaxda-board-svg",
    );
    expect(reducedMotionBlock).toContain("animation: none !important");
    expect(reducedMotionBlock).toContain("display: none");
  });
});

function point(container: HTMLElement, id: string): Element {
  const element = container.querySelector(`[data-point-id="${id}"]`);

  expect(element).not.toBeNull();

  return element as Element;
}

function screenClass(container: HTMLElement, selector: string): string {
  const element = container.querySelector(selector);

  expect(element).not.toBeNull();

  return element?.getAttribute("class") ?? "";
}

function boardSvg(container: HTMLElement): Element {
  const element = container.querySelector(".shaxda-board-svg");

  expect(element).not.toBeNull();

  return element as Element;
}

function moveAnimation(container: HTMLElement): Element {
  const element = container.querySelector(
    '[data-testid="board-move-animation"]',
  );

  expect(element).not.toBeNull();

  return element as Element;
}
