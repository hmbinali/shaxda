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
    lastAction?: { action: GameAction; nonce: number } | null;
    invalidNonce?: number;
  }

  type MoveFeedback = {
    action: Extract<GameAction, { type: "move" }>;
    nonce: number;
  };

  type CaptureFeedback = {
    action: Extract<GameAction, { type: "capture" }>;
    nonce: number;
  };

  let {
    state: gameState,
    selected = null,
    interactive = false,
    onSelectPoint,
    lastAction = null,
    invalidNonce = 0,
  }: Props = $props();

  const view = $derived(buildBoardView(gameState, { selected }));
  const copy = messages.so.boardGallery;
  const moveFeedback = $derived(getMoveFeedback(lastAction));
  const captureFeedback = $derived(getCaptureFeedback(lastAction));
  let focusedPoint = $state<PointId>("O1");
  let boardShell: HTMLDivElement | null = null;
  let boardSvg: SVGSVGElement | null = null;
  let shouldPreserveBoardFocus = false;
  let pointElements = $state<Partial<Record<PointId, SVGGElement>>>({});

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
        onSelectPoint?.(selected);
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

  function getMoveFeedback(feedback: Props["lastAction"]): MoveFeedback | null {
    return feedback?.action.type === "move"
      ? { action: feedback.action, nonce: feedback.nonce }
      : null;
  }

  function getCaptureFeedback(
    feedback: Props["lastAction"],
  ): CaptureFeedback | null {
    return feedback?.action.type === "capture"
      ? { action: feedback.action, nonce: feedback.nonce }
      : null;
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
>
  <svg
    bind:this={boardSvg}
    class="shaxda-board-svg h-full w-full overflow-visible"
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    role="group"
    aria-label={copy.title}
    aria-describedby={interactive ? "shaxda-board-keyboard-help" : undefined}
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
      <linearGradient
        id="shaxda-board-surface"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stop-color="#f3dfc6" />
        <stop offset="44%" stop-color="var(--color-board-100)" />
        <stop offset="100%" stop-color="#b67a45" />
      </linearGradient>
      <linearGradient id="shaxda-carved-line" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#211209" />
        <stop offset="100%" stop-color="#8a5730" />
      </linearGradient>
      <pattern
        id="shaxda-wood-grain"
        patternUnits="userSpaceOnUse"
        width="18"
        height="18"
      >
        <path
          d="M -2 4 C 4 2, 8 6, 18 3 M -1 11 C 5 9, 11 14, 20 10 M 2 16 C 8 15, 12 18, 19 15"
          class="shaxda-wood-grain-line"
        />
      </pattern>
      <filter
        id="shaxda-piece-shadow"
        x="-35%"
        y="-25%"
        width="170%"
        height="170%"
      >
        <feDropShadow
          dx="0"
          dy="0.9"
          stdDeviation="0.8"
          flood-color="#1d120c"
          flood-opacity="0.28"
        />
      </filter>
      <filter
        id="shaxda-board-shadow"
        x="-10%"
        y="-8%"
        width="120%"
        height="120%"
      >
        <feDropShadow
          dx="0"
          dy="1.4"
          stdDeviation="1.2"
          flood-color="#24130a"
          flood-opacity="0.24"
        />
      </filter>
      <filter id="shaxda-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <rect
      x="1.5"
      y="1.5"
      width="97"
      height="97"
      rx="3.5"
      fill="url(#shaxda-board-surface)"
      filter="url(#shaxda-board-shadow)"
      data-testid="board-wood-surface"
    />
    <rect
      x="1.5"
      y="1.5"
      width="97"
      height="97"
      rx="3.5"
      fill="url(#shaxda-wood-grain)"
      class="opacity-45"
      data-testid="board-wood-grain"
    />
    <rect
      x="4"
      y="4"
      width="92"
      height="92"
      rx="2.5"
      class="fill-transparent stroke-board-50/40"
      stroke-width="0.65"
    />

    <g data-testid="board-lines">
      {#each view.lines as line (`${line.a}-${line.b}`)}
        <line
          x1={POINT_COORDS[line.a].x}
          y1={POINT_COORDS[line.a].y}
          x2={POINT_COORDS[line.b].x}
          y2={POINT_COORDS[line.b].y}
          class="stroke-board-50/45"
          stroke-width="2.45"
          stroke-linecap="round"
        />
        <line
          data-testid="board-line"
          x1={POINT_COORDS[line.a].x}
          y1={POINT_COORDS[line.a].y}
          x2={POINT_COORDS[line.b].x}
          y2={POINT_COORDS[line.b].y}
          stroke="url(#shaxda-carved-line)"
          stroke-width="1.7"
          stroke-linecap="round"
        />
      {/each}
    </g>

    <g data-testid="board-jare-lines">
      {#each view.jareLines.filter((line) => line.isCompleted) as line (line.id)}
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
            ? "shaxda-jare-line shaxda-jare-line-active"
            : "shaxda-jare-line"}
          filter="url(#shaxda-glow)"
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
          role={interactive ? "button" : undefined}
          tabindex={interactive
            ? point.id === focusedPoint
              ? 0
              : -1
            : undefined}
          aria-label={accessiblePointLabel(point)}
          onclick={interactive ? () => handlePointClick(point.id) : undefined}
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
            class="fill-board-900/20 stroke-board-50/35"
            stroke-width="0.7"
          />

          {#if point.isLegalHint}
            <circle
              data-testid="board-legal-hint"
              cx={point.x}
              cy={point.y}
              r={SOCKET_RADIUS + 1.8}
              class="shaxda-valid-pulse fill-emerald-500/20 stroke-emerald-700/80"
              stroke-width="0.75"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={LEGAL_HINT_RADIUS}
              class="fill-emerald-800"
            />
          {/if}

          {#if point.isSelected}
            <circle
              data-testid="board-selected-ring"
              cx={point.x}
              cy={point.y}
              r={PIECE_RADIUS + 2.4}
              class="shaxda-selected-glow fill-transparent stroke-sky-700"
              stroke-width="1.15"
              filter="url(#shaxda-glow)"
            />
          {/if}

          {#if point.occupant}
            <circle
              data-testid="board-piece"
              cx={point.x}
              cy={point.y}
              r={PIECE_RADIUS}
              fill={pieceFill(point.occupant)}
              class={`shaxda-piece ${pieceStrokeClass(point.occupant)}`}
              stroke-width="0.65"
              filter="url(#shaxda-piece-shadow)"
            />
          {/if}

          {#if point.isCaptureTarget}
            <circle
              data-testid="board-capture-target"
              cx={point.x}
              cy={point.y}
              r={PIECE_RADIUS + 2.1}
              class="shaxda-target-ring fill-transparent stroke-red-700"
              stroke-width="1.25"
              stroke-dasharray="1.8 1.3"
            />
          {/if}

          {#if point.isRemovalTarget}
            <circle
              data-testid="board-removal-target"
              cx={point.x}
              cy={point.y}
              r={PIECE_RADIUS + 2.1}
              class="shaxda-target-ring fill-transparent stroke-amber-700"
              stroke-width="1.2"
              stroke-dasharray="1.6 1.2"
            />
          {/if}
        </g>
      {/each}
    </g>

    {#if moveFeedback !== null}
      {#key moveFeedback.nonce}
        <circle
          data-testid="board-move-animation"
          data-feedback-nonce={moveFeedback.nonce}
          cx={POINT_COORDS[moveFeedback.action.to].x}
          cy={POINT_COORDS[moveFeedback.action.to].y}
          r={PIECE_RADIUS}
          fill={pieceFill(moveFeedback.action.player)}
          class={`shaxda-move-ghost ${pieceStrokeClass(moveFeedback.action.player)}`}
          stroke-width="0.65"
          style={moveAnimationStyle(moveFeedback.action)}
          filter="url(#shaxda-piece-shadow)"
          pointer-events="none"
        />
      {/key}
    {/if}

    {#if captureFeedback !== null}
      <circle
        data-testid="board-capture-burst"
        data-feedback-nonce={captureFeedback.nonce}
        cx={POINT_COORDS[captureFeedback.action.point].x}
        cy={POINT_COORDS[captureFeedback.action.point].y}
        r={PIECE_RADIUS + 0.6}
        class="shaxda-capture-burst fill-red-500/15 stroke-red-800"
        stroke-width="1.2"
        pointer-events="none"
      />
    {/if}
  </svg>
  {#if interactive}
    <p id="shaxda-board-keyboard-help" class="sr-only">
      {copy.keyboardHelp}
    </p>
  {/if}
</div>
