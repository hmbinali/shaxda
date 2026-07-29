import { fireEvent, render, waitFor } from "@testing-library/svelte";
import {
  applyAction,
  type GameAction,
  type GameState,
} from "@shaxda/game-engine";
import { gameFixtures } from "@shaxda/shared";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import Board from "./Board.svelte";

describe("Board", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
      container.querySelectorAll('[data-testid="board-piece-shadow"]'),
    ).toHaveLength(4);
    expect(
      container.querySelectorAll('[data-testid="board-hit-target"]'),
    ).toHaveLength(24);
    expect(
      container.querySelector('[data-testid="board-hit-target"]'),
    ).toHaveAttribute("r", "6.2");
    expect(
      container.querySelector('[data-testid="board-socket"]'),
    ).toHaveAttribute("r", "2.3");
    expect(
      container.querySelector('[data-testid="board-socket"]'),
    ).toHaveAttribute("stroke-width", "0.55");
    expect(container.querySelector('[data-testid="board-socket"]')).toHaveClass(
      "fill-board-900/16",
      "stroke-board-50/25",
    );
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
    ).toContain("shaxda-selected-halo");
    expect(
      container.querySelector('[data-testid="board-selected-ring"]'),
    ).toHaveAttribute("cy", "49.3");
    expect(container.querySelector(".shaxda-board-svg")).toHaveAttribute(
      "style",
      expect.stringContaining("--shaxda-selected-offset: -0.7px"),
    );
    expect(
      screenClass(container, '[data-testid="board-legal-hint"]'),
    ).toContain("shaxda-cue-enter");
    expect(
      screenClass(container, '[data-testid="board-legal-hint"]'),
    ).toContain("fill-success");
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
    expect(
      container.querySelectorAll('[data-testid="board-capture-minus"]'),
    ).toHaveLength(0);
    expect(
      container.querySelector('[data-testid="board-capture-target"]'),
    ).toHaveClass("stroke-danger");
    expect(
      container.querySelector('[data-testid="board-capture-target"]'),
    ).not.toHaveAttribute("stroke-dasharray");
  });

  it("renders thin initial-removal targets with minus badges", () => {
    const { container } = render(Board, {
      props: { state: gameFixtures.initialRemoval },
    });
    const removalTarget = container.querySelector(
      '[data-testid="board-removal-target"]',
    );

    expect(removalTarget).toHaveClass("stroke-warning");
    expect(removalTarget).not.toHaveAttribute("stroke-dasharray");
    expect(
      container.querySelectorAll('[data-testid="board-removal-minus"]'),
    ).toHaveLength(12);
  });

  it("uses redundant piece glyphs for player identity", () => {
    const { container } = render(Board, {
      props: { state: gameFixtures.midPlacement },
    });

    expect(
      container.querySelectorAll('[data-testid="board-piece-a-dot"]'),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('[data-testid="board-piece-b-ring"]'),
    ).toHaveLength(2);
  });

  it("uses baked shadows and underlays without SVG filters", () => {
    const { container } = render(Board, {
      props: {
        state: gameFixtures.movement,
        selected: "O8",
      },
    });
    const css = readFileSync("src/app.css", "utf8");

    expect(container.querySelector("filter")).not.toBeInTheDocument();
    expect(container.querySelector("feDropShadow")).not.toBeInTheDocument();
    expect(container.querySelector("feGaussianBlur")).not.toBeInTheDocument();
    expect(css).toContain(
      "drop-shadow(0 0.35rem 0.55rem rgb(51 32 22 / 0.16))",
    );
    expect(css).not.toMatch(
      /shaxda-(?:cue|selected|target)[^{]*{[^}]*infinite/s,
    );
  });

  it("temporarily renders only the first-advantage placement jare", async () => {
    vi.useFakeTimers();
    const { container } = render(Board, {
      props: {
        state: gameFixtures.placementJare,
        lastAction: {
          action: { type: "place", player: "A", point: "O3" },
          nonce: 5,
          formedJare: true,
        },
      },
    });

    expect(
      container.querySelector('[data-testid="board-wood-surface"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="board-wood-frame"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-testid="board-frame-layer"]'),
    ).toHaveLength(3);
    expect(
      Array.from(container.querySelectorAll("[data-frame-layer]"), (layer) =>
        layer.getAttribute("data-frame-layer"),
      ),
    ).toEqual(["outer", "dark", "mid", "light"]);
    expect(
      container.querySelector('[data-frame-layer="outer"]'),
    ).toHaveAttribute("fill", "#3D2013");
    expect(
      Array.from(container.querySelectorAll("[data-frame-layer]"), (layer) =>
        layer.getAttribute("fill"),
      ),
    ).toEqual(["#3D2013", "#3D2013", "#5C361F", "#7E4A25"]);
    expect(
      container.querySelector('[data-testid="board-edge-vignette"]'),
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
    expect(jareLine).not.toHaveAttribute("filter");
    expect(
      container.querySelector(".shaxda-jare-line-underlay"),
    ).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1_400);
    expect(
      container.querySelector('[data-testid="board-jare-line"]'),
    ).not.toBeInTheDocument();
  });

  it("does not render standing or later placement jare lines", () => {
    const { container } = render(Board, {
      props: {
        state: gameFixtures.placementJare,
        lastAction: {
          action: { type: "place", player: "A", point: "O3" },
          nonce: 5,
          formedJare: false,
        },
      },
    });

    expect(
      container.querySelector('[data-testid="board-jare-line"]'),
    ).not.toBeInTheDocument();
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

  it("slides the full destination piece group from its source point", () => {
    const action = {
      type: "move",
      player: "B",
      from: "O8",
      to: "O1",
    } as const satisfies GameAction;
    const movedState = apply(gameFixtures.movement, action);
    const { container, rerender } = render(Board, {
      props: {
        state: movedState,
        lastAction: { action, nonce: 7, formedJare: false },
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
    expect(moveAnimation).toHaveClass(
      "shaxda-piece-group",
      "shaxda-piece-slide",
    );
    expect(moveAnimation).toHaveAttribute(
      "style",
      expect.stringContaining("--move-x:"),
    );
    expect(moveAnimation).toHaveAttribute("pointer-events", "none");
    expect(
      moveAnimation?.querySelector('[data-testid="board-piece-shadow"]'),
    ).toBeInTheDocument();
    expect(
      moveAnimation?.querySelector('[data-testid="board-piece-b-ring"]'),
    ).toBeInTheDocument();

    rerender({
      state: gameFixtures.capturePending,
      lastAction: {
        action: { type: "capture", player: "A", point: "O5" },
        nonce: 8,
        formedJare: false,
      },
      invalidNonce: 0,
    });

    const removalFeedback = container.querySelector(
      '[data-testid="board-removal-feedback"]',
    );

    expect(removalFeedback).toHaveAttribute("data-feedback-nonce", "8");
    expect(removalFeedback).toHaveAttribute("pointer-events", "none");
    expect(removalFeedback).toHaveAttribute("aria-hidden", "true");
    expect(
      removalFeedback?.querySelector('[data-testid="board-removal-ghost"]'),
    ).toHaveClass("shaxda-removal-ghost");
    expect(
      removalFeedback?.querySelector(
        '[data-testid="board-removal-confirmation"]',
      ),
    ).toHaveClass("shaxda-removal-confirmation", "stroke-danger");
  });

  it("animates an initially removed stone with the same removal feedback", () => {
    const { container } = render(Board, {
      props: {
        state: gameFixtures.movement,
        lastAction: {
          action: { type: "removeInitial", player: "A", point: "O2" },
          nonce: 9,
          formedJare: false,
        },
      },
    });

    expect(
      container.querySelector('[data-testid="board-removal-ghost"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="board-removal-confirmation"]'),
    ).toHaveClass("stroke-warning");
  });

  it("pops the full piece group after placement", () => {
    const { container } = render(Board, {
      props: {
        state: gameFixtures.midPlacement,
        lastAction: {
          action: { type: "place", player: "B", point: "M3" },
          nonce: 4,
          formedJare: false,
        },
      },
    });
    const placeAnimation = container.querySelector(
      '[data-testid="board-place-animation"]',
    );

    expect(placeAnimation).toHaveClass(
      "shaxda-piece-group",
      "shaxda-piece-pop",
    );
    expect(
      placeAnimation?.querySelector('[data-testid="board-piece-shadow"]'),
    ).toBeInTheDocument();
    expect(
      placeAnimation?.querySelector('[data-testid="board-piece-b-ring"]'),
    ).toBeInTheDocument();
  });

  it("replays consecutive invalid shakes without remounting the SVG", async () => {
    const { container, rerender } = render(Board, {
      props: {
        state: gameFixtures.movement,
        lastAction: {
          action: { type: "move", player: "B", from: "O8", to: "O1" },
          nonce: 7,
          formedJare: false,
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
        formedJare: false,
      },
      invalidNonce: 2,
    });

    await waitFor(() => expect(shell).toHaveClass("shaxda-invalid-shake"));
    expect(shell).toHaveAttribute("data-invalid-shake", "2");
    expect(boardSvg(container)).toBe(initialSvg);
  });

  it("keeps static board points non-interactive by default", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const { container } = render(Board, {
      props: { state: gameFixtures.emptyBoard },
    });

    expect(point(container, "O1")).not.toHaveAttribute("role");
    expect(point(container, "O1")).not.toHaveAttribute("tabindex");
    expect(
      addEventListener.mock.calls.some(
        ([event, , options]) => event === "pointerdown" && options === true,
      ),
    ).toBe(false);
    expect(
      addEventListener.mock.calls.some(
        ([event, , options]) => event === "keydown" && options === true,
      ),
    ).toBe(false);
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
    const onCancelSelection = vi.fn();
    const { container } = render(Board, {
      props: {
        state: gameFixtures.movement,
        selected: "O8",
        interactive: true,
        onSelectPoint,
        onCancelSelection,
      },
    });

    await fireEvent.keyDown(point(container, "O8"), { key: "Escape" });

    expect(onCancelSelection).toHaveBeenCalledOnce();
    expect(onSelectPoint).not.toHaveBeenCalled();
  });

  it("silently cancels selection after an outside pointer tap", async () => {
    const onCancelSelection = vi.fn();
    const { container } = render(Board, {
      props: {
        state: gameFixtures.movement,
        selected: "O8",
        interactive: true,
        onCancelSelection,
      },
    });
    const outside = document.createElement("button");
    document.body.append(outside);

    await fireEvent.pointerDown(point(container, "O1"));
    expect(onCancelSelection).not.toHaveBeenCalled();

    await fireEvent.pointerDown(outside);
    expect(onCancelSelection).toHaveBeenCalledOnce();

    outside.remove();
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

  it("tracks pointer and keyboard modality only for interactive boards", async () => {
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
    expect(container.querySelector('[data-testid="board"]')).toHaveAttribute(
      "data-input-modality",
      "pointer",
    );

    await fireEvent.keyDown(point(container, "O1"), { key: "Tab" });
    expect(container.querySelector('[data-testid="board"]')).toHaveAttribute(
      "data-input-modality",
      "keyboard",
    );

    await fireEvent.pointerDown(point(container, "O1"));
    expect(container.querySelector('[data-testid="board"]')).toHaveAttribute(
      "data-input-modality",
      "pointer",
    );
    expect(container.querySelector(".shaxda-focus-ring")).toHaveClass(
      "stroke-focus",
    );
    expect(css).toContain(
      '.shaxda-board-shell[data-input-modality="keyboard"]',
    );
    expect(css).toContain("-webkit-tap-highlight-color: transparent");
  });

  it("shows a pressed response while a pointer is down", async () => {
    const { container } = render(Board, {
      props: {
        state: gameFixtures.midPlacement,
        interactive: true,
      },
    });

    await fireEvent.pointerDown(point(container, "O1"));
    expect(point(container, "O1")).toHaveAttribute("data-pressed", "true");

    await fireEvent.pointerUp(point(container, "O1"));
    expect(point(container, "O1")).not.toHaveAttribute("data-pressed");
  });

  it("marks only unselected blocked space-making candidates", async () => {
    const { container, rerender } = render(Board, {
      props: { state: gameFixtures.blockedPlayer },
    });

    expect(
      container.querySelectorAll(
        '[data-testid="board-space-making-candidate"]',
      ),
    ).not.toHaveLength(0);

    await rerender({ state: gameFixtures.blockedPlayer, selected: "O2" });
    expect(
      container.querySelectorAll(
        '[data-testid="board-space-making-candidate"]',
      ),
    ).toHaveLength(0);
  });

  it("defines reduced-motion CSS that disables animated L2 effects", () => {
    const css = readFileSync("src/app.css", "utf8");
    const reducedMotionBlock = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)"),
    );

    expect(reducedMotionBlock).toContain(".shaxda-cue-enter");
    expect(reducedMotionBlock).toContain(".shaxda-piece-slide");
    expect(reducedMotionBlock).toContain(".shaxda-piece-pop");
    expect(reducedMotionBlock).toContain(".shaxda-removal-ghost");
    expect(reducedMotionBlock).toContain(".shaxda-removal-confirmation");
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

function apply(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.state;
}
