<script lang="ts">
  import type { PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import type { GameStatus } from "$lib/game/status";

  interface Props {
    status: GameStatus;
    playerName: (player: PlayerId) => string;
    reason?: string | null;
    testId: string;
  }

  let { status, playerName, reason = null, testId }: Props = $props();

  const copy = messages.so.localGame;
</script>

<section
  class="rounded border border-board-700/20 bg-board-900 p-4 text-board-50"
  data-testid={testId}
>
  {#if status.winner === null}
    <h2 class="text-lg font-semibold">{copy.result.drawLabel}</h2>
  {:else}
    <h2 class="text-lg font-semibold">
      {copy.result.winnerLabel}: {playerName(status.winner)}
    </h2>
  {/if}
  {#if reason !== null}
    <p class="mt-2 text-sm leading-6 text-board-100">
      {reason}
    </p>
  {/if}
</section>
