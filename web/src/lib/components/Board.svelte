<script lang="ts">
  import { messages } from "@shaxda/i18n";
  import type { GameState, PointId, PlayerId } from "@shaxda/game-engine";
  import {
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
  }

  let {
    state,
    selected = null,
    interactive = false,
    onSelectPoint,
  }: Props = $props();

  const view = $derived(buildBoardView(state, { selected }));
  const copy = messages.so.boardGallery;

  function pieceLabel(player: PlayerId, point: PointId): string {
    return `${copy.playerPiece[player]} ${point}`;
  }

  function pointLabel(point: PointId): string {
    return `${copy.emptyPoint} ${point}`;
  }

  function handlePointKeydown(event: KeyboardEvent, point: PointId): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelectPoint?.(point);
  }
</script>

<div class="mx-auto aspect-square w-full max-w-[34rem]" data-testid="board">
  <svg
    class="h-full w-full overflow-visible"
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label={copy.title}
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
    </defs>

    <rect
      x="1.5"
      y="1.5"
      width="97"
      height="97"
      rx="3.5"
      class="fill-board-100"
    />
    <rect
      x="4"
      y="4"
      width="92"
      height="92"
      rx="2.5"
      class="fill-transparent stroke-board-700/30"
      stroke-width="0.8"
    />

    <g data-testid="board-lines">
      {#each view.lines as line (`${line.a}-${line.b}`)}
        <line
          data-testid="board-line"
          x1={POINT_COORDS[line.a].x}
          y1={POINT_COORDS[line.a].y}
          x2={POINT_COORDS[line.b].x}
          y2={POINT_COORDS[line.b].y}
          class="stroke-board-900/65"
          stroke-width="1.55"
          stroke-linecap="round"
        />
      {/each}
    </g>

    <g data-testid="board-points">
      {#each view.points as point (point.id)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <g
          data-testid="board-point"
          data-point-id={point.id}
          data-occupant={point.occupant ?? "empty"}
          data-selected={point.isSelected ? "true" : undefined}
          data-legal-hint={point.isLegalHint ? "true" : undefined}
          data-capture-target={point.isCaptureTarget ? "true" : undefined}
          data-removal-target={point.isRemovalTarget ? "true" : undefined}
          role={interactive ? "button" : undefined}
          tabindex={interactive ? 0 : undefined}
          aria-label={point.occupant
            ? pieceLabel(point.occupant, point.id)
            : pointLabel(point.id)}
          onclick={interactive ? () => onSelectPoint?.(point.id) : undefined}
          onkeydown={interactive
            ? (event) => handlePointKeydown(event, point.id)
            : undefined}
        >
          <title>
            {point.occupant
              ? pieceLabel(point.occupant, point.id)
              : pointLabel(point.id)}
          </title>

          <circle
            data-testid="board-socket"
            cx={point.x}
            cy={point.y}
            r={SOCKET_RADIUS}
            class="fill-board-900/15 stroke-board-900/50"
            stroke-width="0.7"
          />

          {#if point.isLegalHint}
            <circle
              data-testid="board-legal-hint"
              cx={point.x}
              cy={point.y}
              r={SOCKET_RADIUS + 1.8}
              class="fill-emerald-500/20 stroke-emerald-700/80"
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
              class="fill-transparent stroke-sky-700"
              stroke-width="1.15"
            />
          {/if}

          {#if point.occupant}
            <circle
              data-testid="board-piece"
              cx={point.x}
              cy={point.y}
              r={PIECE_RADIUS}
              fill={point.occupant === "A"
                ? "url(#shaxda-piece-a)"
                : "url(#shaxda-piece-b)"}
              class={point.occupant === "A"
                ? "stroke-board-900/45"
                : "stroke-board-50/35"}
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
              class="fill-transparent stroke-red-700"
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
              class="fill-transparent stroke-amber-700"
              stroke-width="1.2"
              stroke-dasharray="1.6 1.2"
            />
          {/if}
        </g>
      {/each}
    </g>
  </svg>
</div>
