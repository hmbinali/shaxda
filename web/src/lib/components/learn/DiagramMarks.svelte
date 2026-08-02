<script lang="ts">
  import type { PointId } from "@shaxda/game-engine";
  import { POINT_COORDS, type BoardCoord } from "$lib/board/layout";
  import type { DiagramMark, DiagramMarkStatus } from "$lib/learn/diagrams";

  interface Props {
    marks: readonly DiagramMark[];
  }

  let { marks }: Props = $props();

  const instanceId = $props.id();
  const markerIds = {
    legal: `${instanceId}-arrow-legal`,
    illegal: `${instanceId}-arrow-illegal`,
    highlight: `${instanceId}-arrow-highlight`,
    neutral: `${instanceId}-arrow-neutral`,
  } as const;

  function coord(point: PointId): BoardCoord {
    return POINT_COORDS[point];
  }

  function midpoint(from: PointId, to: PointId): BoardCoord {
    return {
      x: (coord(from).x + coord(to).x) / 2,
      y: (coord(from).y + coord(to).y) / 2,
    };
  }

  function pointList(points: readonly PointId[]): string {
    return points
      .map((point) => `${coord(point).x},${coord(point).y}`)
      .join(" ");
  }

  function labelPosition(mark: DiagramMark): BoardCoord {
    const base =
      mark.kind === "arrow"
        ? midpoint(mark.from, mark.to)
        : mark.kind === "ring"
          ? coord(mark.point)
          : coord(mark.labelAt);

    return {
      x: base.x + (mark.labelOffset?.x ?? 0),
      y: base.y + (mark.labelOffset?.y ?? 0),
    };
  }

  function color(status: DiagramMarkStatus): string {
    switch (status) {
      case "legal":
        return "var(--color-success)";
      case "illegal":
        return "var(--color-danger)";
      case "highlight":
        return "var(--color-jare)";
      case "neutral":
        return "var(--color-focus)";
    }
  }
</script>

<defs>
  {#each Object.entries(markerIds) as [status, id] (id)}
    <marker
      {id}
      viewBox="0 0 10 10"
      refX="8.5"
      refY="5"
      markerWidth="4"
      markerHeight="4"
      orient="auto-start-reverse"
    >
      <path
        d="M 0 0 L 10 5 L 0 10 z"
        fill={color(status as DiagramMarkStatus)}
      />
    </marker>
  {/each}
</defs>

{#each marks as mark, index (`${mark.kind}-${mark.label}-${index}`)}
  {@const label = labelPosition(mark)}
  {#if mark.kind === "arrow"}
    {@const from = coord(mark.from)}
    {@const to = coord(mark.to)}
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={color(mark.status)}
      stroke-width="1.25"
      stroke-dasharray={mark.status === "illegal" ? "2.2 1.6" : undefined}
      stroke-linecap="round"
      marker-end={`url(#${markerIds[mark.status]})`}
    />
    <text
      x={to.x}
      y={to.y - 2.8}
      fill={color(mark.status)}
      font-size="5"
      font-weight="800"
      text-anchor="middle"
      stroke="var(--color-board-50)"
      stroke-width="1.8"
      paint-order="stroke">{mark.status === "illegal" ? "✗" : "✓"}</text
    >
  {:else if mark.kind === "ring"}
    {@const point = coord(mark.point)}
    <circle
      cx={point.x}
      cy={point.y}
      r="6.6"
      fill="none"
      stroke={color(mark.status)}
      stroke-width="1.5"
      stroke-dasharray="2.4 1.5"
    />
  {:else}
    <polyline
      points={pointList(mark.points)}
      fill="none"
      stroke={color(mark.status)}
      stroke-width={mark.kind === "outline" ? "0.9" : "2.1"}
      stroke-dasharray={mark.kind === "outline" ? "2.5 1.5" : undefined}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {/if}

  <text
    x={label.x}
    y={label.y}
    fill={color(mark.status)}
    font-size="3.25"
    font-weight="750"
    text-anchor="middle"
    stroke="var(--color-board-50)"
    stroke-width="1.9"
    paint-order="stroke">{mark.label}</text
  >
{/each}
