<script lang="ts">
  import type { PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";

  interface Props {
    player: PlayerId;
    count: number;
  }

  let { player, count }: Props = $props();

  const copy = messages.so.localGame.tabletop;
  const slots = Array.from({ length: 12 }, (_, index) => index);
</script>

<div
  class="reserve"
  data-testid={`reserve-tray-${player}`}
  role="img"
  aria-label={`${copy.reserve}: ${count}`}
>
  <div class="tray" aria-hidden="true">
    {#each slots as slot (slot)}
      <span class="slot">
        {#if slot < count}
          <span class:light={player === "A"} class:dark={player === "B"}></span>
        {/if}
      </span>
    {/each}
  </div>
  <span class="count" aria-hidden="true">{count}</span>
</div>

<style>
  .reserve {
    display: grid;
    min-width: 2rem;
    place-items: center;
  }

  .tray {
    display: none;
    grid-template-columns: repeat(6, 0.7rem);
    gap: 0.15rem;
    border: 1px solid rgb(106 61 37 / 0.28);
    border-radius: 0.65rem;
    background: rgb(234 215 195 / 0.85);
    padding: 0.25rem;
    box-shadow: inset 0 1px 3px rgb(55 32 19 / 0.14);
  }

  .slot,
  .slot > span {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 999px;
  }

  .slot {
    display: grid;
    place-items: center;
    background: rgb(83 48 29 / 0.12);
  }

  .slot > span {
    border: 1px solid rgb(46 22 15 / 0.45);
  }

  .light {
    background: radial-gradient(
      circle at 33% 28%,
      #fffaf1,
      #f3dfbf 62%,
      #a8886d
    );
  }

  .dark {
    background: radial-gradient(
      circle at 33% 28%,
      #9f6d4d,
      #5b3020 60%,
      #25120d
    );
  }

  .count {
    display: grid;
    min-width: 1.75rem;
    height: 1.75rem;
    place-items: center;
    border-radius: 999px;
    background: rgb(46 32 25 / 0.1);
    font-size: 0.75rem;
    font-weight: 800;
  }

  @container tabletop (min-height: 380px) {
    .tray {
      display: grid;
      grid-template-columns: repeat(6, 0.55rem);
    }

    .slot,
    .slot > span {
      width: 0.55rem;
      height: 0.55rem;
    }

    .count {
      display: none;
    }
  }

  @container tabletop (min-height: 460px) {
    .tray {
      grid-template-columns: repeat(6, 0.7rem);
    }

    .slot,
    .slot > span {
      width: 0.7rem;
      height: 0.7rem;
    }
  }
</style>
