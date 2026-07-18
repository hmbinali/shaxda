<script lang="ts">
  import type { GameStatus } from "$lib/game/status";
  import {
    buildAnnouncement,
    buildStateSummary,
    type AnnouncedAction,
    type PlayerName,
  } from "$lib/game/announce";

  interface Props {
    lastAction?: AnnouncedAction | null;
    status: GameStatus;
    playerName: PlayerName;
    stateSyncNonce?: number;
  }

  let {
    lastAction = null,
    status,
    playerName,
    stateSyncNonce = 0,
  }: Props = $props();

  let announcement = $state("");
  let initialized = false;
  let previousActionNonce = 0;
  let previousStateSyncNonce = 0;

  $effect(() => {
    const actionNonce = lastAction?.nonce ?? 0;
    const firstUpdate = !initialized;
    const actionChanged = actionNonce !== previousActionNonce;
    const syncChanged = stateSyncNonce !== previousStateSyncNonce;

    initialized = true;
    previousActionNonce = actionNonce;
    previousStateSyncNonce = stateSyncNonce;

    if (lastAction !== null && (firstUpdate || actionChanged)) {
      announcement = buildAnnouncement(lastAction, status, playerName);
      return;
    }

    if (stateSyncNonce > 0 && (firstUpdate || syncChanged)) {
      announcement = buildStateSummary(status, playerName);
    }
  });
</script>

<div
  class="sr-only"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  data-testid="game-announcer"
>
  {announcement}
</div>
