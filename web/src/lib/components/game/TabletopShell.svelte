<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    topRail: Snippet;
    board: Snippet;
    bottomRail: Snippet;
    details?: Snippet;
    compactRails?: boolean;
    orientation: "shared" | "solo";
  }

  let {
    topRail,
    board,
    bottomRail,
    details,
    compactRails = false,
    orientation,
  }: Props = $props();
</script>

<section class="route-shell" data-orientation={orientation}>
  <div class="tabletop-frame">
    <div class="tabletop" class:compact={compactRails} data-testid="tabletop">
      {@render topRail()}
      <div class="board-stage" data-testid="board-stage">
        <div class="board-square">
          {@render board()}
        </div>
      </div>
      {@render bottomRail()}
    </div>
  </div>

  {#if details}
    <aside class="details">
      {@render details()}
    </aside>
  {/if}
</section>

<style>
  .route-shell {
    display: grid;
    min-height: 100%;
    min-width: 0;
  }

  .tabletop-frame {
    container-name: tabletop;
    container-type: size;
    display: grid;
    min-width: 0;
    min-height: 0;
    place-items: stretch center;
  }

  .tabletop {
    display: grid;
    grid-template-rows: 3rem minmax(13.75rem, 1fr) 3rem;
    gap: 0.25rem;
    width: 100%;
    height: 100%;
    min-height: 20.25rem;
    max-width: 48rem;
    padding: 0.25rem;
  }

  .board-stage {
    container-name: board-stage;
    container-type: size;
    display: grid;
    min-width: 0;
    min-height: 13.75rem;
    place-items: center;
  }

  .board-square {
    position: relative;
    width: min(100cqw, 100cqh, 44rem);
    aspect-ratio: 1;
  }

  .details {
    display: none;
  }

  @container tabletop (min-height: 380px) {
    .tabletop {
      grid-template-rows: 4rem minmax(13.75rem, 1fr) 4rem;
    }

    .tabletop.compact {
      grid-template-rows: 3.5rem minmax(13.75rem, 1fr) 3.5rem;
    }
  }

  @container tabletop (min-height: 460px) {
    .tabletop {
      grid-template-rows: 5.5rem minmax(13.75rem, 1fr) 5.5rem;
    }

    .tabletop.compact {
      grid-template-rows: 4.5rem minmax(13.75rem, 1fr) 4.5rem;
    }
  }

  @media (min-width: 64rem) {
    .route-shell {
      grid-template-columns: minmax(0, 1fr) 20rem;
      gap: 1rem;
      height: 100%;
      padding: 1rem;
    }

    .details {
      display: grid;
      align-content: start;
      gap: 1rem;
      min-height: 0;
      overflow-y: auto;
    }
  }
</style>
