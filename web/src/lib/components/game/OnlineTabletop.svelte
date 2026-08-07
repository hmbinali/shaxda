<script lang="ts">
  import { Trophy } from "@lucide/svelte";
  import type { PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import { onMount } from "svelte";
  import Board from "$components/Board.svelte";
  import Button from "$components/ui/Button.svelte";
  import type { OnlineGameController } from "$lib/online/onlineGame.svelte";
  import {
    instructionKeyFor,
    railStateFor,
    resolveSeating,
  } from "$lib/game/seating";
  import BoardNotice from "./BoardNotice.svelte";
  import GameResultOverlay from "./GameResultOverlay.svelte";
  import type { GameResultAction } from "./gameResultActions";
  import InvalidToast from "./InvalidToast.svelte";
  import PlayerRail from "./PlayerRail.svelte";
  import TabletopShell from "./TabletopShell.svelte";
  import type { TransientToastMessage } from "$lib/notices/toast.svelte";

  interface Props {
    controller: OnlineGameController;
    viewer: PlayerId;
    toast: TransientToastMessage | null;
    playerName: (player: PlayerId) => string;
    resultReason: string | null;
    onNewMatch: () => void;
  }

  let {
    controller,
    viewer,
    toast,
    playerName,
    resultReason,
    onNewMatch,
  }: Props = $props();

  const copy = messages.so.onlineGame;
  const orientation = $derived({ orientation: "solo", viewer } as const);
  const seating = $derived(resolveSeating(orientation));
  const status = $derived(controller.status);
  let topRailElement = $state<HTMLElement | null>(null);
  let bottomRailElement = $state<HTMLElement | null>(null);
  let topBar = $state<HTMLElement | null>(null);

  onMount(() => {
    topBar = document.querySelector<HTMLElement>('[data-testid="app-top-bar"]');
  });

  const newMatchAction = $derived({
    id: "new-match",
    label: copy.newRoom,
    variant: "outline" as const,
    onSelect: onNewMatch,
    testId: "online-new-match",
  });
  const rematchAction = $derived({
    id: "rematch",
    label: copy.rematch.request,
    variant: "primary" as const,
    onSelect: () => controller.requestRematch(),
    testId: "online-rematch",
  });
  const resultActions = $derived.by((): GameResultAction[] => {
    if (!controller.canRematch) {
      return [{ ...newMatchAction, variant: "primary" }];
    }

    switch (controller.rematchStage) {
      case "opponentRequested":
        return [
          { ...rematchAction, label: copy.rematch.accept },
          {
            id: "rematch-decline",
            label: copy.rematch.decline,
            variant: "outline",
            onSelect: () => controller.declineRematch(),
            testId: "online-rematch-decline",
          },
          newMatchAction,
        ];
      case "requested":
      case "starting":
        return [{ ...newMatchAction, variant: "primary" }];
      default:
        return [rematchAction, newMatchAction];
    }
  });
  const resultNotice = $derived.by((): string | null => {
    if (!controller.canRematch) {
      return null;
    }

    switch (controller.rematchStage) {
      case "requested":
        return copy.rematch.notices.requested;
      case "opponentRequested":
        return copy.rematch.notices.opponentRequested;
      case "declinedByMe":
        return copy.rematch.notices.declinedByMe;
      case "declinedByOpponent":
        return copy.rematch.notices.declinedByOpponent;
      case "starting":
        return copy.rematch.notices.starting;
      default:
        return null;
    }
  });

  function noticeFor(player: PlayerId): string | null {
    if (player === viewer) {
      if (controller.connectionStatus === "reconnecting") {
        return copy.notices.reconnecting;
      }
      if (controller.isIdlePlayer) {
        return copy.notices.idleNudge;
      }
      return null;
    }

    return controller.opponentConnected === false && status.phase !== "gameOver"
      ? copy.notices.opponentDisconnected
      : null;
  }
</script>

<h1 class="sr-only">{copy.heading}</h1>

<div class="h-full min-h-full">
  <TabletopShell orientation="solo" compactRails={status.phase !== "placement"}>
    {#snippet topRail()}
      <PlayerRail
        bind:element={topRailElement}
        player={seating.top}
        {status}
        {viewer}
        name={playerName(seating.top)}
        username={controller.presence[seating.top]?.username}
        avatar={controller.presence[seating.top]?.avatar}
        railState={railStateFor(status, seating.top)}
        instruction={instructionKeyFor(status, seating.top, orientation)}
        notice={noticeFor(seating.top)}
        connected={controller.connections[seating.top]}
      />
    {/snippet}

    {#snippet board()}
      <div class="relative h-full w-full" data-testid="online-board">
        <Board
          state={controller.state}
          selected={controller.selected}
          lastAction={controller.lastAction}
          invalidNonce={controller.invalidNonce}
          interactive={controller.boardInteractive}
          onSelectPoint={(point) => controller.clickPoint(point)}
          onCancelSelection={() => controller.cancelSelection()}
        />

        {#if controller.canClaimWin}
          <BoardNotice title={copy.notices.claimAvailable}>
            {#snippet actions()}
              <Button
                variant="success"
                size="compact"
                onclick={() => controller.claimWin()}
              >
                <Trophy size={16} aria-hidden="true" />
                {copy.claimWin}
              </Button>
            {/snippet}
          </BoardNotice>
        {/if}

        {#if toast !== null}
          <InvalidToast
            message={toast.message}
            nonce={toast.nonce}
            testId="online-feedback"
          />
        {/if}

        {#if status.phase === "gameOver"}
          <GameResultOverlay
            {status}
            {playerName}
            reason={resultReason}
            notice={resultNotice}
            testId="online-game-result"
            actions={resultActions}
            inertTargets={[topBar, topRailElement, bottomRailElement]}
          />
        {/if}
      </div>
    {/snippet}

    {#snippet bottomRail()}
      <PlayerRail
        bind:element={bottomRailElement}
        player={seating.bottom}
        {status}
        {viewer}
        name={playerName(seating.bottom)}
        username={controller.presence[seating.bottom]?.username}
        avatar={controller.presence[seating.bottom]?.avatar}
        badge={`(${copy.youLabel})`}
        railState={railStateFor(status, seating.bottom)}
        instruction={instructionKeyFor(status, seating.bottom, orientation)}
        notice={noticeFor(seating.bottom)}
        connected={controller.connections[seating.bottom]}
      />
    {/snippet}
  </TabletopShell>
</div>
