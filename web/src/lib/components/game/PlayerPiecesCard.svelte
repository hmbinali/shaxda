<script lang="ts">
  import type { PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import type { GameStatus } from "$lib/game/status";

  interface Props {
    status: GameStatus;
    playerName: (player: PlayerId) => string;
  }

  let { status, playerName }: Props = $props();

  const copy = messages.so.localGame;
  const players = ["A", "B"] as const;
</script>

<section class="rounded border border-board-700/20 bg-white/60 p-4">
  <h2 class="text-base font-semibold tracking-normal">
    {copy.piecesLabel}
  </h2>
  <div class="mt-3 grid gap-3">
    {#each players as player (player)}
      <article class="rounded border border-board-700/15 bg-board-50 p-3">
        <h3 class="font-semibold">{playerName(player)}</h3>
        <dl class="mt-2 grid grid-cols-3 gap-2 text-sm text-board-700">
          <div>
            <dt>{copy.inHandLabel}</dt>
            <dd class="font-semibold text-board-900">
              {status.players[player].inHand}
            </dd>
          </div>
          <div>
            <dt>{copy.onBoardLabel}</dt>
            <dd class="font-semibold text-board-900">
              {status.players[player].onBoard}
            </dd>
          </div>
          <div>
            <dt>{copy.capturedLabel}</dt>
            <dd class="font-semibold text-board-900">
              {status.players[player].captured}
            </dd>
          </div>
        </dl>
      </article>
    {/each}
  </div>
</section>
