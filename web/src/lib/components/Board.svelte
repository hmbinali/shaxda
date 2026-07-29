<script lang="ts">
  import { ADJACENCY } from "@shaxda/game-engine";
  import type {
    GameAction,
    GameState,
    PointId,
    PlayerId,
  } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import { tick } from "svelte";
  import {
    HIT_RADIUS,
    LEGAL_HINT_RADIUS,
    PIECE_RADIUS,
    POINT_COORDS,
    SOCKET_RADIUS,
  } from "$lib/board/layout";
  import { buildBoardView } from "$lib/board/view-model";

  interface Props {
    state: GameState;
    selected?: PointId | null;
    interactive?: boolean;
    onSelectPoint?: (point: PointId) => void;
    onCancelSelection?: () => void;
    lastAction?: {
      action: GameAction;
      nonce: number;
      formedJare: boolean;
    } | null;
    invalidNonce?: number;
  }

  type PieceFeedback = {
    action: Extract<GameAction, { type: "move" | "place" }>;
    nonce: number;
  };

  type RemovalFeedback = {
    action: Extract<GameAction, { type: "capture" | "removeInitial" }>;
    nonce: number;
  };

  const SELECTED_PIECE_OFFSET = -0.7;

  let {
    state: gameState,
    selected = null,
    interactive = false,
    onSelectPoint,
    onCancelSelection,
    lastAction = null,
    invalidNonce = 0,
  }: Props = $props();

  let visiblePlacementJareNonce = $state<number | null>(null);
  const presentedLastAction = $derived(
    lastAction?.action.type === "place" &&
      lastAction.nonce !== visiblePlacementJareNonce
      ? null
      : lastAction,
  );
  const view = $derived(
    buildBoardView(gameState, {
      selected,
      lastAction: presentedLastAction,
    }),
  );
  const copy = messages.so.boardGallery;
  const pieceFeedback = $derived(getPieceFeedback(lastAction));
  const removalFeedback = $derived(getRemovalFeedback(lastAction));
  let focusedPoint = $state<PointId>("O1");
  let inputModality = $state<"keyboard" | "pointer">("pointer");
  let pressedPoint = $state<PointId | null>(null);
  let boardShell: HTMLDivElement | null = null;
  let boardSvg: SVGSVGElement | null = null;
  let shouldPreserveBoardFocus = false;
  let pointElements = $state<Partial<Record<PointId, SVGGElement>>>({});

  $effect(() => {
    const feedback = lastAction;

    if (feedback?.action.type !== "place" || !feedback.formedJare) {
      visiblePlacementJareNonce = null;
      return;
    }

    visiblePlacementJareNonce = feedback.nonce;
    const timeout = window.setTimeout(() => {
      if (visiblePlacementJareNonce === feedback.nonce) {
        visiblePlacementJareNonce = null;
      }
    }, 1_400);

    return () => window.clearTimeout(timeout);
  });

  $effect(() => {
    if (!interactive) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      inputModality = "pointer";

      if (
        selected !== null &&
        boardShell !== null &&
        event.target instanceof Node &&
        !boardShell.contains(event.target)
      ) {
        onCancelSelection?.();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isBoardKeyboardKey(event.key)) {
        inputModality = "keyboard";
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  });

  $effect(() => {
    const shell = boardShell;
    const nonce = invalidNonce;

    if (shell === null || nonce <= 0) {
      return;
    }

    shell.classList.remove("shaxda-invalid-shake");
    void shell.offsetWidth;

    const frame = requestAnimationFrame(() => {
      shell.classList.add("shaxda-invalid-shake");
    });

    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    void gameState;

    if (!interactive || !shouldPreserveBoardFocus) {
      return;
    }

    void tick().then(() => {
      if (
        shouldPreserveBoardFocus &&
        boardSvg !== null &&
        !boardSvg.contains(document.activeElement)
      ) {
        pointElements[focusedPoint]?.focus();
      }
    });
  });

  function pieceLabel(player: PlayerId, point: PointId): string {
    return `${copy.playerPiece[player]} ${point}`;
  }

  function pointLabel(point: PointId): string {
    return `${copy.emptyPoint} ${point}`;
  }

  function handlePointKeydown(event: KeyboardEvent, point: PointId): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusedPoint = point;
      onSelectPoint?.(point);
      return;
    }

    if (event.key === "Escape") {
      if (selected !== null) {
        event.preventDefault();
        onCancelSelection?.();
      }
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusPoint("O1");
      return;
    }

    const direction = arrowDirection(event.key);

    if (direction === null) {
      return;
    }

    const neighbor = bestAlignedNeighbor(point, direction);

    if (neighbor !== null) {
      event.preventDefault();
      focusPoint(neighbor);
    }
  }

  function handlePointClick(point: PointId): void {
    focusedPoint = point;
    onSelectPoint?.(point);
  }

  function handlePointPointerDown(point: PointId): void {
    pressedPoint = point;
  }

  function clearPressedPoint(): void {
    pressedPoint = null;
  }

  function handlePointFocus(point: PointId): void {
    focusedPoint = point;
    shouldPreserveBoardFocus = true;
  }

  function handleBoardFocusOut(event: FocusEvent): void {
    if (
      boardSvg === null ||
      !(event.relatedTarget instanceof Node) ||
      !boardSvg.contains(event.relatedTarget)
    ) {
      shouldPreserveBoardFocus = false;
    }
  }

  function focusPoint(point: PointId): void {
    focusedPoint = point;
    pointElements[point]?.focus();
  }

  function arrowDirection(key: string): { x: number; y: number } | null {
    switch (key) {
      case "ArrowLeft":
        return { x: -1, y: 0 };
      case "ArrowRight":
        return { x: 1, y: 0 };
      case "ArrowUp":
        return { x: 0, y: -1 };
      case "ArrowDown":
        return { x: 0, y: 1 };
      default:
        return null;
    }
  }

  function bestAlignedNeighbor(
    point: PointId,
    direction: { x: number; y: number },
  ): PointId | null {
    const origin = POINT_COORDS[point];
    let best: { point: PointId; alignment: number } | null = null;

    for (const neighbor of ADJACENCY[point]) {
      const destination = POINT_COORDS[neighbor];
      const deltaX = destination.x - origin.x;
      const deltaY = destination.y - origin.y;
      const distance = Math.hypot(deltaX, deltaY);
      const alignment =
        (deltaX * direction.x + deltaY * direction.y) / distance;

      if (alignment >= 0.5 && (best === null || alignment > best.alignment)) {
        best = { point: neighbor, alignment };
      }
    }

    return best?.point ?? null;
  }

  function accessiblePointLabel(point: (typeof view.points)[number]): string {
    const labels = [
      point.occupant
        ? pieceLabel(point.occupant, point.id)
        : pointLabel(point.id),
    ];

    if (point.isSelected) labels.push(copy.selectedPoint);
    if (point.isLegalHint) labels.push(copy.legalHint);
    if (point.isCaptureTarget) labels.push(copy.captureTarget);
    if (point.isRemovalTarget) labels.push(copy.removalTarget);
    if (view.movablePoints.has(point.id)) labels.push(copy.movablePiece);

    return labels.join(". ");
  }

  function pieceFill(player: PlayerId): string {
    return player === "A" ? "url(#shaxda-piece-a)" : "url(#shaxda-piece-b)";
  }

  function pieceStrokeClass(player: PlayerId): string {
    return player === "A" ? "stroke-board-900/45" : "stroke-board-50/35";
  }

  function getPieceFeedback(
    feedback: Props["lastAction"],
  ): PieceFeedback | null {
    return feedback?.action.type === "move" || feedback?.action.type === "place"
      ? { action: feedback.action, nonce: feedback.nonce }
      : null;
  }

  function isPieceFeedbackDestination(point: PointId): boolean {
    if (pieceFeedback === null) {
      return false;
    }

    return pieceFeedback.action.type === "move"
      ? pieceFeedback.action.to === point
      : pieceFeedback.action.point === point;
  }

  function pieceAnimationKey(point: PointId): string {
    return isPieceFeedbackDestination(point)
      ? `${point}-${pieceFeedback?.nonce ?? 0}`
      : point;
  }

  function pieceAnimationClass(point: PointId): string {
    const selectionClass =
      view.points.find((candidate) => candidate.id === point)?.isSelected ===
      true
        ? " shaxda-piece-selected"
        : "";

    if (!isPieceFeedbackDestination(point) || pieceFeedback === null) {
      return `shaxda-piece-group${selectionClass}`;
    }

    return pieceFeedback.action.type === "move"
      ? `shaxda-piece-group shaxda-piece-slide${selectionClass}`
      : `shaxda-piece-group shaxda-piece-pop${selectionClass}`;
  }

  function pieceAnimationTestId(point: PointId): string | undefined {
    if (!isPieceFeedbackDestination(point) || pieceFeedback === null) {
      return undefined;
    }

    return pieceFeedback.action.type === "move"
      ? "board-move-animation"
      : "board-place-animation";
  }

  function pieceAnimationStyle(point: PointId): string | undefined {
    return isPieceFeedbackDestination(point) &&
      pieceFeedback?.action.type === "move"
      ? moveAnimationStyle(pieceFeedback.action)
      : undefined;
  }

  function getRemovalFeedback(
    feedback: Props["lastAction"],
  ): RemovalFeedback | null {
    return feedback?.action.type === "capture" ||
      feedback?.action.type === "removeInitial"
      ? { action: feedback.action, nonce: feedback.nonce }
      : null;
  }

  function removedPlayer(action: RemovalFeedback["action"]): PlayerId {
    return action.player === "A" ? "B" : "A";
  }

  function removalConfirmationClass(action: RemovalFeedback["action"]): string {
    return action.type === "capture" ? "stroke-danger" : "stroke-warning";
  }

  function isBoardKeyboardKey(key: string): boolean {
    return [
      "Tab",
      "Enter",
      " ",
      "Escape",
      "Home",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ].includes(key);
  }

  function moveAnimationStyle(
    action: Extract<GameAction, { type: "move" }>,
  ): string {
    const from = POINT_COORDS[action.from];
    const to = POINT_COORDS[action.to];

    return `--move-x: ${from.x - to.x}px; --move-y: ${from.y - to.y}px;`;
  }

  function handleBoardAnimationEnd(event: AnimationEvent): void {
    if (event.animationName === "shaxda-invalid-shake") {
      boardShell?.classList.remove("shaxda-invalid-shake");
    }
  }
</script>

<div
  bind:this={boardShell}
  class="shaxda-board-shell mx-auto aspect-square w-full max-w-[34rem]"
  data-testid="board"
  data-invalid-shake={invalidNonce > 0 ? invalidNonce : undefined}
  data-input-modality={inputModality}
>
  <svg
    bind:this={boardSvg}
    class="shaxda-board-svg h-full w-full overflow-visible"
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    role="group"
    aria-label={copy.title}
    aria-describedby={interactive ? "shaxda-board-keyboard-help" : undefined}
    style={`--shaxda-selected-offset: ${SELECTED_PIECE_OFFSET}px;`}
    onfocusout={handleBoardFocusOut}
    onanimationend={handleBoardAnimationEnd}
  >
    <defs>
      <radialGradient id="shaxda-piece-a" cx="34%" cy="28%" r="72%">
        <stop offset="0%" stop-color="#fff6e6" />
        <stop offset="58%" stop-color="var(--color-board-100)" />
        <stop offset="100%" stop-color="#8a5730" />
      </radialGradient>
      <radialGradient id="shaxda-piece-b" cx="34%" cy="28%" r="72%">
        <stop offset="0%" stop-color="#9a6a49" />
        <stop offset="55%" stop-color="var(--color-board-700)" />
        <stop offset="100%" stop-color="var(--color-board-900)" />
      </radialGradient>
      <radialGradient id="shaxda-board-surface" cx="50%" cy="45%" r="72%">
        <stop offset="0%" stop-color="#f6e3c7" />
        <stop offset="58%" stop-color="#d7aa78" />
        <stop offset="100%" stop-color="#a86638" />
      </radialGradient>
      <radialGradient id="shaxda-board-vignette" cx="50%" cy="50%" r="68%">
        <stop offset="62%" stop-color="#4b2714" stop-opacity="0" />
        <stop offset="100%" stop-color="#4b2714" stop-opacity="0.24" />
      </radialGradient>
      <linearGradient id="shaxda-carved-line" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#2c160c" />
        <stop offset="100%" stop-color="#5e321b" />
      </linearGradient>
      <pattern
        id="shaxda-wood-grain"
        patternUnits="userSpaceOnUse"
        width="18"
        height="18"
      >
        <path
          d="M -3 2 C 2 0, 8 4, 20 1 M -2 5 C 5 3, 12 8, 21 4 M -1 10 C 4 8, 11 13, 20 9 M -4 14 C 3 12, 9 17, 20 13 M 1 17 C 7 16, 13 19, 21 16"
          class="shaxda-wood-grain-line"
        />
      </pattern>
    </defs>

    <rect
      x="0.7"
      y="0.7"
      width="98.6"
      height="98.6"
      rx="5.4"
      fill="#3D2013"
      data-testid="board-wood-frame"
      data-frame-layer="outer"
      aria-hidden="true"
      pointer-events="none"
    />
    <rect
      x="1.3"
      y="1.3"
      width="97.4"
      height="97.4"
      rx="4.9"
      fill="#3D2013"
      data-testid="board-frame-layer"
      data-frame-layer="dark"
      aria-hidden="true"
      pointer-events="none"
    />
    <rect
      x="2.1"
      y="2.1"
      width="95.8"
      height="95.8"
      rx="4.25"
      fill="#5C361F"
      data-testid="board-frame-layer"
      data-frame-layer="mid"
      aria-hidden="true"
      pointer-events="none"
    />
    <rect
      x="3"
      y="3"
      width="94"
      height="94"
      rx="3.6"
      fill="#7E4A25"
      data-testid="board-frame-layer"
      data-frame-layer="light"
      aria-hidden="true"
      pointer-events="none"
    />
    <rect
      x="3.8"
      y="3.8"
      width="92.4"
      height="92.4"
      rx="3"
      fill="url(#shaxda-board-surface)"
      data-testid="board-wood-surface"
      aria-hidden="true"
      pointer-events="none"
    />
    <rect
      x="3.8"
      y="3.8"
      width="92.4"
      height="92.4"
      rx="3"
      fill="url(#shaxda-wood-grain)"
      class="opacity-55"
      data-testid="board-wood-grain"
      aria-hidden="true"
      pointer-events="none"
    />
    <rect
      x="3.8"
      y="3.8"
      width="92.4"
      height="92.4"
      rx="3"
      fill="url(#shaxda-board-vignette)"
      data-testid="board-edge-vignette"
      aria-hidden="true"
      pointer-events="none"
    />
    <rect
      x="3.4"
      y="3.4"
      width="93.2"
      height="93.2"
      rx="3.35"
      class="fill-transparent stroke-board-900/30"
      stroke-width="0.5"
      aria-hidden="true"
      pointer-events="none"
    />
    <rect
      x="4.3"
      y="4.3"
      width="91.4"
      height="91.4"
      rx="2.55"
      class="fill-transparent stroke-board-50/22"
      stroke-width="0.35"
      aria-hidden="true"
      pointer-events="none"
    />

    <g data-testid="board-lines" aria-hidden="true" pointer-events="none">
      {#each view.lines as line (`${line.a}-${line.b}`)}
        <line
          x1={POINT_COORDS[line.a].x}
          y1={POINT_COORDS[line.a].y}
          x2={POINT_COORDS[line.b].x}
          y2={POINT_COORDS[line.b].y}
          class="stroke-board-900/38"
          stroke-width="2.65"
          stroke-linecap="round"
        />
        <line
          data-testid="board-line"
          x1={POINT_COORDS[line.a].x}
          y1={POINT_COORDS[line.a].y}
          x2={POINT_COORDS[line.b].x}
          y2={POINT_COORDS[line.b].y}
          stroke="url(#shaxda-carved-line)"
          stroke-width="1.45"
          stroke-linecap="round"
        />
      {/each}
    </g>

    <g data-testid="board-jare-lines" aria-hidden="true" pointer-events="none">
      {#each view.jareLines as line (line.id)}
        <polyline
          points={line.points
            .map((point) => `${POINT_COORDS[point].x},${POINT_COORDS[point].y}`)
            .join(" ")}
          class="shaxda-jare-line-underlay"
        />
        <polyline
          data-testid="board-jare-line"
          data-jare-line-id={line.id}
          data-owner={line.owner}
          data-active-pending-capture={line.isActivePendingCapture
            ? "true"
            : undefined}
          points={line.points
            .map((point) => `${POINT_COORDS[point].x},${POINT_COORDS[point].y}`)
            .join(" ")}
          class={line.isActivePendingCapture
            ? "shaxda-jare-line shaxda-jare-line-active shaxda-cue-enter"
            : "shaxda-jare-line shaxda-cue-enter"}
        />
      {/each}
    </g>

    <g data-testid="board-points">
      {#each view.points as point (point.id)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <g
          bind:this={pointElements[point.id]}
          class="shaxda-board-point"
          data-testid="board-point"
          data-point-id={point.id}
          data-occupant={point.occupant ?? "empty"}
          data-selected={point.isSelected ? "true" : undefined}
          data-legal-hint={point.isLegalHint ? "true" : undefined}
          data-capture-target={point.isCaptureTarget ? "true" : undefined}
          data-removal-target={point.isRemovalTarget ? "true" : undefined}
          data-space-making-candidate={point.isSpaceMakingCandidate
            ? "true"
            : undefined}
          data-pressed={pressedPoint === point.id ? "true" : undefined}
          role={interactive ? "button" : undefined}
          tabindex={interactive
            ? point.id === focusedPoint
              ? 0
              : -1
            : undefined}
          aria-label={accessiblePointLabel(point)}
          onclick={interactive ? () => handlePointClick(point.id) : undefined}
          onpointerdown={interactive
            ? () => handlePointPointerDown(point.id)
            : undefined}
          onpointerup={interactive ? clearPressedPoint : undefined}
          onpointercancel={interactive ? clearPressedPoint : undefined}
          onpointerleave={interactive ? clearPressedPoint : undefined}
          onfocus={interactive ? () => handlePointFocus(point.id) : undefined}
          onkeydown={interactive
            ? (event) => handlePointKeydown(event, point.id)
            : undefined}
        >
          <circle
            data-testid="board-hit-target"
            cx={point.x}
            cy={point.y}
            r={HIT_RADIUS}
            fill="transparent"
            aria-hidden="true"
            pointer-events="all"
          />
          <title>
            {accessiblePointLabel(point)}
          </title>

          <circle
            cx={point.x}
            cy={point.y}
            r={PIECE_RADIUS + 3.15}
            class="shaxda-focus-ring-underlay fill-transparent stroke-board-50"
            stroke-width="2.9"
            aria-hidden="true"
            pointer-events="none"
          />
          <circle
            cx={point.x}
            cy={point.y}
            r={PIECE_RADIUS + 3.15}
            class="shaxda-focus-ring fill-transparent stroke-focus"
            stroke-width="1.35"
            aria-hidden="true"
            pointer-events="none"
          />

          <circle
            data-testid="board-socket"
            cx={point.x}
            cy={point.y}
            r={SOCKET_RADIUS}
            class="fill-board-900/16 stroke-board-50/25"
            stroke-width="0.55"
            aria-hidden="true"
            pointer-events="none"
          />

          {#if point.isLegalHint}
            <circle
              cx={point.x}
              cy={point.y}
              r={LEGAL_HINT_RADIUS + 1.35}
              class="shaxda-cue-enter fill-emerald-50/85"
              aria-hidden="true"
              pointer-events="none"
            />
            <circle
              data-testid="board-legal-hint"
              cx={point.x}
              cy={point.y}
              r={LEGAL_HINT_RADIUS}
              class="shaxda-cue-enter fill-success"
              aria-hidden="true"
              pointer-events="none"
            />
          {/if}

          {#if point.isSelected}
            <circle
              data-testid="board-selected-ring"
              cx={point.x}
              cy={point.y + SELECTED_PIECE_OFFSET}
              r={PIECE_RADIUS + 1.65}
              class="shaxda-selected-halo shaxda-cue-enter fill-transparent stroke-selected"
              stroke-width="1.85"
              aria-hidden="true"
              pointer-events="none"
            />
          {/if}

          {#if point.isSpaceMakingCandidate}
            <circle
              data-testid="board-space-making-candidate"
              cx={point.x}
              cy={point.y}
              r={PIECE_RADIUS + 1.3}
              class="shaxda-cue-enter fill-transparent stroke-success/80"
              stroke-width="0.85"
              aria-hidden="true"
              pointer-events="none"
            />
          {/if}

          {#if point.occupant}
            {#key pieceAnimationKey(point.id)}
              <g
                data-testid={pieceAnimationTestId(point.id)}
                data-feedback-nonce={isPieceFeedbackDestination(point.id)
                  ? pieceFeedback?.nonce
                  : undefined}
                class={pieceAnimationClass(point.id)}
                style={pieceAnimationStyle(point.id)}
                aria-hidden="true"
                pointer-events="none"
              >
                <circle
                  data-testid="board-piece-shadow"
                  cx={point.x + 0.65}
                  cy={point.y + 0.9}
                  r={PIECE_RADIUS}
                  class="fill-board-900/25"
                />
                <circle
                  data-testid="board-piece"
                  cx={point.x}
                  cy={point.y}
                  r={PIECE_RADIUS}
                  fill={pieceFill(point.occupant)}
                  class={`shaxda-piece ${pieceStrokeClass(point.occupant)}`}
                  stroke-width="0.65"
                />
                {#if point.occupant === "A"}
                  <circle
                    data-testid="board-piece-a-dot"
                    cx={point.x}
                    cy={point.y}
                    r="0.85"
                    class="fill-board-900/80"
                  />
                {:else}
                  <circle
                    data-testid="board-piece-b-ring"
                    cx={point.x}
                    cy={point.y}
                    r="2.45"
                    class="fill-transparent stroke-board-50/75"
                    stroke-width="0.55"
                  />
                {/if}
              </g>
            {/key}
          {/if}

          {#if point.isCaptureTarget}
            <circle
              data-testid="board-capture-target"
              cx={point.x}
              cy={point.y}
              r={PIECE_RADIUS + 1.45}
              class="shaxda-cue-enter fill-transparent stroke-danger"
              stroke-width="1"
              aria-hidden="true"
              pointer-events="none"
            />
          {/if}

          {#if point.isRemovalTarget}
            <circle
              data-testid="board-removal-target"
              cx={point.x}
              cy={point.y}
              r={PIECE_RADIUS + 1.45}
              class="shaxda-cue-enter fill-transparent stroke-warning"
              stroke-width="1"
              aria-hidden="true"
              pointer-events="none"
            />
            <g
              data-testid="board-removal-minus"
              class="shaxda-cue-enter"
              aria-hidden="true"
              pointer-events="none"
            >
              <circle
                cx={point.x + 4.5}
                cy={point.y - 4.5}
                r="1.55"
                class="fill-warning"
              />
              <line
                x1={point.x + 3.75}
                y1={point.y - 4.5}
                x2={point.x + 5.25}
                y2={point.y - 4.5}
                class="stroke-white"
                stroke-width="0.55"
                stroke-linecap="round"
              />
            </g>
          {/if}
        </g>
      {/each}
    </g>

    {#if removalFeedback !== null}
      <g
        data-testid="board-removal-feedback"
        data-feedback-nonce={removalFeedback.nonce}
        aria-hidden="true"
        pointer-events="none"
      >
        <g data-testid="board-removal-ghost" class="shaxda-removal-ghost">
          <circle
            cx={POINT_COORDS[removalFeedback.action.point].x + 0.65}
            cy={POINT_COORDS[removalFeedback.action.point].y + 0.9}
            r={PIECE_RADIUS}
            class="fill-board-900/25"
          />
          <circle
            cx={POINT_COORDS[removalFeedback.action.point].x}
            cy={POINT_COORDS[removalFeedback.action.point].y}
            r={PIECE_RADIUS}
            fill={pieceFill(removedPlayer(removalFeedback.action))}
            class={`shaxda-piece ${pieceStrokeClass(removedPlayer(removalFeedback.action))}`}
            stroke-width="0.65"
          />
        </g>
        <circle
          data-testid="board-removal-confirmation"
          cx={POINT_COORDS[removalFeedback.action.point].x}
          cy={POINT_COORDS[removalFeedback.action.point].y}
          r={PIECE_RADIUS + 0.6}
          class={`shaxda-removal-confirmation fill-transparent ${removalConfirmationClass(removalFeedback.action)}`}
          stroke-width="1"
        />
      </g>
    {/if}
  </svg>
  {#if interactive}
    <p id="shaxda-board-keyboard-help" class="sr-only">
      {copy.keyboardHelp}
    </p>
  {/if}
</div>
