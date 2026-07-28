<script lang="ts">
  import type { PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import type { GameStatus } from "$lib/game/status";
  import Button from "$components/ui/Button.svelte";
  import GameResultCard from "./GameResultCard.svelte";

  interface Props {
    status: GameStatus;
    playerName: (player: PlayerId) => string;
    reason?: string | null;
    testId: string;
    orientation: "shared" | "solo";
    onNewGame?: () => void;
    onLeave?: () => void;
  }

  let {
    status,
    playerName,
    reason = null,
    testId,
    orientation,
    onNewGame,
    onLeave,
  }: Props = $props();

  const copy = messages.so.localGame;
  const onlineCopy = messages.so.onlineGame;
</script>

<section
  class="overlay"
  class:shared={orientation === "shared"}
  data-testid={testId}
>
  {#each orientation === "shared" ? [true, false] : [false] as rotate, index (index)}
    <div class="half" class:rotated={rotate}>
      <GameResultCard {status} {playerName} {reason} />
      {#if onNewGame}
        <Button variant="primary" onclick={onNewGame}>
          {copy.controls.newGame}
        </Button>
      {:else if onLeave}
        <Button variant="primary" onclick={onLeave}>
          {onlineCopy.leave}
        </Button>
      {/if}
    </div>
  {/each}
</section>

<style>
  .overlay {
    position: absolute;
    z-index: 25;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(46 32 25 / 0.55);
    padding: 1rem;
  }

  .overlay.shared {
    grid-template-rows: 1fr 1fr;
  }

  .half {
    display: grid;
    width: min(100%, 20rem);
    gap: 0.5rem;
    align-self: center;
  }

  .rotated {
    transform: rotate(180deg);
  }
</style>
