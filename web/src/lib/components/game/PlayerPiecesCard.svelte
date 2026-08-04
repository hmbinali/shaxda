<script lang="ts">
  import type { PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import { resolve } from "$app/paths";
  import Avatar from "$components/account/Avatar.svelte";
  import type { GameStatus } from "$lib/game/status";

  interface Props {
    status: GameStatus;
    playerName: (player: PlayerId) => string;
    playerIdentity?: (player: PlayerId) => PlayerIdentity | null;
  }

  type PlayerIdentity = {
    username: string;
    avatar: {
      mode: "initial" | "google";
      imageUrl: string | null;
      color: string;
      initial: string;
    };
  };

  let { status, playerName, playerIdentity = () => null }: Props = $props();

  const copy = messages.so.localGame;
  const players = ["A", "B"] as const;
</script>

<section class="rounded-lg border border-board-700/20 bg-white/60 p-4">
  <h2 class="text-base font-semibold">
    {copy.piecesLabel}
  </h2>
  <div class="mt-3 grid gap-3">
    {#each players as player (player)}
      {@const identity = playerIdentity(player)}
      <article class="rounded-lg border border-board-700/15 bg-board-50 p-3">
        {#if identity === null}
          <h3 class="min-w-0 truncate font-semibold" title={playerName(player)}>
            {playerName(player)}
          </h3>
        {:else}
          <div class="flex min-w-0 items-center gap-2">
            <Avatar
              username={identity.username}
              initial={identity.avatar.initial}
              color={identity.avatar.color}
              avatarMode={identity.avatar.mode}
              imageUrl={identity.avatar.imageUrl}
              size="small"
            />
            <a
              class="min-w-0 truncate font-semibold underline"
              href={resolve("/u/[username]", { username: identity.username })}
              title={`@${identity.username}`}>@{identity.username}</a
            >
          </div>
        {/if}
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
