<script lang="ts">
  import type { LearnDiagramId } from "$lib/learn/diagrams";
  import RuleDiagram from "./RuleDiagram.svelte";

  export interface DiagramFrame {
    id: LearnDiagramId;
    title: string;
    caption: string;
    description: string;
  }

  interface Props {
    label: string;
    frames: readonly DiagramFrame[];
    columns?: 2 | 3;
  }

  let { label, frames, columns = 2 }: Props = $props();
</script>

<ol
  class="mt-6 grid gap-4"
  class:md:grid-cols-2={columns >= 2 && frames.length > 1}
  class:xl:grid-cols-3={columns === 3 && frames.length > 2}
  aria-label={label}
>
  {#each frames as frame, index (frame.id)}
    <li class="min-w-0">
      <span class="sr-only">Tallaabada {index + 1}</span>
      <RuleDiagram
        diagramId={frame.id}
        title={frame.title}
        caption={frame.caption}
        description={frame.description}
      />
    </li>
  {/each}
</ol>
