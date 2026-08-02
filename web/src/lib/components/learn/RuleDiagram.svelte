<script lang="ts">
  import Board from "$lib/components/Board.svelte";
  import { getLearnDiagram, type LearnDiagramId } from "$lib/learn/diagrams";
  import DiagramMarks from "./DiagramMarks.svelte";

  interface Props {
    diagramId: LearnDiagramId;
    title: string;
    caption: string;
    description: string;
  }

  let { diagramId, title, caption, description }: Props = $props();

  const instanceId = $props.id();
  const descriptionId = `${instanceId}-description`;
  const diagram = $derived(getLearnDiagram(diagramId));
</script>

{#snippet overlay()}
  <DiagramMarks marks={diagram.marks} />
{/snippet}

<figure
  class="rounded-2xl border border-board-700/20 bg-white/65 p-3 shadow-sm"
  data-diagram-id={diagramId}
>
  <Board
    state={diagram.state}
    selected={diagram.selected}
    ariaLabel={title}
    ariaDescribedBy={descriptionId}
    {overlay}
  />
  <figcaption class="px-1 pb-1 pt-4">
    <span class="block font-semibold text-board-900">{title}</span>
    <span class="mt-1 block text-sm leading-6 text-board-700">{caption}</span>
    <span id={descriptionId} class="sr-only">
      {description}
    </span>
  </figcaption>
</figure>
