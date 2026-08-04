<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    topRail: Snippet;
    board: Snippet;
    bottomRail: Snippet;
    compactRails?: boolean;
    orientation: "shared" | "solo";
  }

  let {
    topRail,
    board,
    bottomRail,
    compactRails = false,
    orientation,
  }: Props = $props();
</script>

<section class="route-shell" data-orientation={orientation}>
  <div class="tabletop-frame">
    <div class="tabletop" class:compact={compactRails} data-testid="tabletop">
      <div class="rail-slot">
        {@render topRail()}
      </div>
      <div class="board-square">
        {@render board()}
      </div>
      <div class="rail-slot">
        {@render bottomRail()}
      </div>
    </div>
  </div>
</section>

<style>
  .route-shell {
    display: grid;
    min-height: 100%;
    min-width: 0;
    background:
      radial-gradient(
        circle at 50% 46%,
        rgb(255 253 249 / 0.98),
        rgb(247 238 227 / 0.9)
      ),
      var(--color-board-50);
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
    --rail-h: 3rem;
    --stack-gap: 0.5rem;
    --board-min: 13.75rem;
    --board-size: clamp(
      var(--board-min),
      min(
        100cqw - 1rem,
        100cqh - 2 * var(--rail-h) - 2 * var(--stack-gap) - 1rem
      ),
      44rem
    );

    display: grid;
    grid-template-rows: var(--rail-h) var(--board-size) var(--rail-h);
    gap: var(--stack-gap);
    justify-items: center;
    align-content: safe center;
    width: 100%;
    height: 100%;
    min-height: calc(
      var(--board-min) + 2 * var(--rail-h) + 2 * var(--stack-gap) + 1rem
    );
    max-width: 48rem;
    padding: 0.5rem;
    transition: grid-template-rows 180ms ease;
  }

  .rail-slot {
    container-name: rail;
    container-type: inline-size;
    display: grid;
    width: var(--board-size);
  }

  .board-square {
    position: relative;
    width: var(--board-size);
    aspect-ratio: 1;
  }

  @container tabletop (min-height: 380px) {
    .tabletop {
      --rail-h: 4rem;
    }

    .tabletop.compact {
      --rail-h: 3.5rem;
    }
  }

  @container tabletop (min-height: 460px) {
    .tabletop {
      --rail-h: min(
        5.5rem,
        max(4rem, calc((100cqh - 17.5rem - 2 * var(--stack-gap) - 1rem) / 2))
      );
    }

    .tabletop.compact {
      --rail-h: min(
        4.5rem,
        max(3.5rem, calc((100cqh - 17.5rem - 2 * var(--stack-gap) - 1rem) / 2))
      );
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tabletop {
      transition: none;
    }
  }
</style>
