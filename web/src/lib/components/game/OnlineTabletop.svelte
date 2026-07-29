<script lang="ts">
  import { Trophy } from "@lucide/svelte";
  import type { PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import Board from "$components/Board.svelte";
  import Button from "$components/ui/Button.svelte";
  import type { OnlineGameController } from "$lib/online/onlineGame.svelte";
  import {
    instructionKeyFor,
    railStateFor,
    resolveSeating,
  } from "$lib/game/seating";
  import BoardNotice from "./BoardNotice.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import GameResultOverlay from "./GameResultOverlay.svelte";
  import InvalidToast from "./InvalidToast.svelte";
  import PlayerRail from "./PlayerRail.svelte";
  import TabletopShell from "./TabletopShell.svelte";

  interface Props {
    controller: OnlineGameController;
    viewer: PlayerId;
    invalidMessage: string | null;
    playerName: (player: PlayerId) => string;
    resultReason: string | null;
    pendingConfirm: "resign" | "leave" | null;
    onRequestConfirm: (action: "resign" | "leave" | null) => void;
    onLeave: () => void;
  }

  let {
    controller,
    viewer,
    invalidMessage,
    playerName,
    resultReason,
    pendingConfirm,
    onRequestConfirm,
    onLeave,
  }: Props = $props();

  const copy = messages.so.onlineGame;
  const gameCopy = messages.so.localGame;
  const orientation = $derived({ orientation: "solo", viewer } as const);
  const seating = $derived(resolveSeating(orientation));
  const status = $derived(controller.status);
  let tabletopBackground = $state<HTMLElement | null>(null);

  function confirmAction(): void {
    const action = pendingConfirm;
    onRequestConfirm(null);

    if (action === "resign") {
      controller.resign();
    } else if (action === "leave") {
      onLeave();
    }
  }

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

<div bind:this={tabletopBackground} class="h-full min-h-full">
  <TabletopShell orientation="solo" compactRails={status.phase !== "placement"}>
    {#snippet topRail()}
      <PlayerRail
        player={seating.top}
        {status}
        {viewer}
        name={playerName(seating.top)}
        railState={railStateFor(status, seating.top)}
        instruction={instructionKeyFor(status, seating.top, orientation)}
        notice={noticeFor(seating.top)}
      />
    {/snippet}

    {#snippet board()}
      <div class="relative h-full w-full" data-testid="online-board">
        <Board
          state={controller.state}
          selected={controller.selected}
          lastAction={controller.lastAction}
          invalidNonce={controller.invalidNonce}
          interactive={controller.canInteract}
          onSelectPoint={(point) => controller.clickPoint(point)}
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

        {#if invalidMessage !== null}
          <InvalidToast message={invalidMessage} testId="online-feedback" />
        {/if}

        {#if status.phase === "gameOver"}
          <GameResultOverlay
            {status}
            {playerName}
            reason={resultReason}
            testId="online-game-result"
            orientation="solo"
            {onLeave}
          />
        {/if}
      </div>
    {/snippet}

    {#snippet bottomRail()}
      <PlayerRail
        player={seating.bottom}
        {status}
        {viewer}
        name={`${playerName(seating.bottom)} (${copy.youLabel})`}
        railState={railStateFor(status, seating.bottom)}
        instruction={instructionKeyFor(status, seating.bottom, orientation)}
        notice={noticeFor(seating.bottom)}
      />
    {/snippet}
  </TabletopShell>
</div>

<ConfirmDialog
  open={pendingConfirm !== null}
  title={pendingConfirm === "resign" ? gameCopy.controls.resign : copy.leave}
  body={pendingConfirm === "resign"
    ? gameCopy.prompts.resign
    : gameCopy.prompts.leave}
  cancelLabel={gameCopy.tabletop.cancel}
  confirmLabel={gameCopy.tabletop.confirm}
  background={tabletopBackground}
  onClose={() => onRequestConfirm(null)}
  onConfirm={confirmAction}
/>
