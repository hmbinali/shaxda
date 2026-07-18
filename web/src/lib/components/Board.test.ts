import { fireEvent, render, waitFor } from "@testing-library/svelte";
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
    expect(
      container.querySelectorAll('[data-testid="board-hit-target"]'),
    ).toHaveLength(24);
    expect(
      container.querySelector('[data-testid="board-hit-target"]'),
    ).toHaveAttribute("r", "6.2");
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

  it("replays consecutive invalid shakes without remounting the SVG", async () => {
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
    const shell = container.querySelector('[data-testid="board"]');

    await waitFor(() => expect(shell).toHaveClass("shaxda-invalid-shake"));
    await fireEvent.animationEnd(initialSvg, {
      animationName: "shaxda-invalid-shake",
    });

    await rerender({
      state: gameFixtures.movement,
      lastAction: {
        action: { type: "move", player: "B", from: "O8", to: "O1" },
        nonce: 9,
      },
      invalidNonce: 2,
    });

    await waitFor(() => expect(shell).toHaveClass("shaxda-invalid-shake"));
    expect(shell).toHaveAttribute("data-invalid-shake", "2");
    expect(boardSvg(container)).toBe(initialSvg);
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

    expect(point(container, "O1")).toHaveAttribute("role", "button");
    expect(point(container, "O1")).toHaveAttribute("tabindex", "0");

    await fireEvent.click(point(container, "O1"));
    await fireEvent.keyDown(point(container, "O2"), { key: "Enter" });
    await fireEvent.keyDown(point(container, "O3"), { key: " " });
    await fireEvent.keyDown(point(container, "O4"), { key: "Escape" });

    expect(
      container.querySelectorAll('[data-testid="board-point"][tabindex="0"]'),
    ).toHaveLength(1);
    expect(onSelectPoint).toHaveBeenCalledTimes(3);
    expect(onSelectPoint).toHaveBeenNthCalledWith(1, "O1");
    expect(onSelectPoint).toHaveBeenNthCalledWith(2, "O2");
    expect(onSelectPoint).toHaveBeenNthCalledWith(3, "O3");
  });

  it("navigates carved-line neighbors with arrow keys and Home", async () => {
    const { container } = render(Board, {
      props: {
        state: gameFixtures.emptyBoard,
        interactive: true,
      },
    });

    (point(container, "O1") as SVGGElement).focus();
    await fireEvent.keyDown(point(container, "O1"), { key: "ArrowRight" });
    expect(point(container, "O2")).toHaveFocus();

    await fireEvent.keyDown(point(container, "O2"), { key: "Home" });
    expect(point(container, "O1")).toHaveFocus();

    await fireEvent.keyDown(point(container, "O1"), { key: "ArrowDown" });
    expect(point(container, "O8")).toHaveFocus();
    expect(point(container, "O8")).toHaveAttribute("tabindex", "0");
    expect(point(container, "O1")).toHaveAttribute("tabindex", "-1");
  });

  it("uses Escape to deselect the current piece", async () => {
    const onSelectPoint = vi.fn();
    const { container } = render(Board, {
      props: {
        state: gameFixtures.movement,
        selected: "O8",
        interactive: true,
        onSelectPoint,
      },
    });

    await fireEvent.keyDown(point(container, "O8"), { key: "Escape" });

    expect(onSelectPoint).toHaveBeenCalledWith("O8");
  });

  it("syncs the roving tab stop to pointer activation", async () => {
    const { container } = render(Board, {
      props: {
        state: gameFixtures.emptyBoard,
        interactive: true,
      },
    });

    await fireEvent.click(point(container, "M4"));

    expect(point(container, "M4")).toHaveAttribute("tabindex", "0");
    expect(point(container, "O1")).toHaveAttribute("tabindex", "-1");
  });

  it("retains focused-point focus across state updates", async () => {
    const { container, rerender } = render(Board, {
      props: {
        state: gameFixtures.emptyBoard,
        interactive: true,
      },
    });

    (point(container, "O1") as SVGGElement).focus();
    await rerender({
      state: gameFixtures.midPlacement,
      interactive: true,
    });

    await waitFor(() => expect(point(container, "O1")).toHaveFocus());
  });

  it("provides keyboard instructions and a distinct focus-visible cue", () => {
    const { container } = render(Board, {
      props: {
        state: gameFixtures.emptyBoard,
        interactive: true,
      },
    });
    const svg = boardSvg(container);
    const css = readFileSync("src/app.css", "utf8");

    expect(svg).toHaveAttribute(
      "aria-describedby",
      "shaxda-board-keyboard-help",
    );
    expect(container.querySelector(".shaxda-focus-ring")).toHaveClass(
      "stroke-focus",
    );
    expect(css).toContain(
      ".shaxda-board-point:focus-visible .shaxda-focus-ring",
    );
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
      ".shaxda-invalid-shake .shaxda-board-svg",
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
