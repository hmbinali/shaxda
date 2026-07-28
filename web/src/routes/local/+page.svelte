<script lang="ts">
  import { RotateCcw, Volume2, VolumeX } from "@lucide/svelte";
  import {
    legalActions,
    type GameState,
    type PlayerId,
  } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import { onMount } from "svelte";
  import {
    SoundPlayer,
    loadSoundPreference,
    saveSoundPreference,
  } from "$lib/audio/sound";
  import Board from "$components/Board.svelte";
  import BoardNotice from "$components/game/BoardNotice.svelte";
  import ConfirmSheet from "$components/game/ConfirmSheet.svelte";
  import GameActionsMenu from "$components/game/GameActionsMenu.svelte";
  import GameAnnouncer from "$components/game/GameAnnouncer.svelte";
  import GameDetailsPanel from "$components/game/GameDetailsPanel.svelte";
  import GameResultOverlay from "$components/game/GameResultOverlay.svelte";
  import InvalidToast from "$components/game/InvalidToast.svelte";
  import PlayerRail from "$components/game/PlayerRail.svelte";
  import TabletopShell from "$components/game/TabletopShell.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import Button from "$components/ui/Button.svelte";
  import { createLocalGameController } from "$lib/game/localGame.svelte";
  import {
    instructionKeyFor,
    railStateFor,
    resolveSeating,
  } from "$lib/game/seating";

  const copy = messages.so.localGame;
  const orientation = { orientation: "shared" } as const;
  const seating = resolveSeating(orientation);
  const controller = createLocalGameController();
  const soundPlayer = new SoundPlayer();

  let soundEnabled = $state(true);
  let lastFeedbackNonce = 0;
  let pendingConfirm = $state<"newGame" | "resign" | null>(null);
  let confirmEdge = $state<"top" | "bottom">("bottom");
  let tabletopBackground = $state<HTMLElement | null>(null);
  const status = $derived(controller.status);
  const resignOwner = $derived(findResignOwner(controller.state));
  const invalidMessage = $derived(
    controller.invalid === null
      ? null
      : copy.invalid[controller.invalid.reason],
  );

  onMount(() => {
    soundEnabled = loadSoundPreference();
  });

  $effect(() => {
    const feedback = controller.feedback;
    if (feedback === null || feedback.nonce === lastFeedbackNonce) {
      return;
    }

    lastFeedbackNonce = feedback.nonce;
    if (!soundEnabled) {
      return;
    }

    void soundPlayer.play(feedback.cues);
  });

  function playerName(player: PlayerId): string {
    return copy.playerNames[player];
  }

  function toggleSound(): void {
    soundEnabled = !soundEnabled;
    saveSoundPreference(soundEnabled);

    if (soundEnabled) {
      void soundPlayer.unlock();
    }
  }

  function requestNewGame(): void {
    pendingConfirm = "newGame";
    confirmEdge = "bottom";
  }

  function requestResign(player: PlayerId): void {
    pendingConfirm = "resign";
    confirmEdge = player === seating.top ? "top" : "bottom";
  }

  function confirmAction(): void {
    const action = pendingConfirm;
    pendingConfirm = null;

    if (action === "newGame") {
      controller.startNewGame();
    } else if (action === "resign") {
      controller.resign();
    }
  }

  function findResignOwner(state: GameState): PlayerId | null {
    return (
      legalActions(state).find((action) => action.type === "resign")?.player ??
      null
    );
  }
</script>

<PageMeta title={copy.title} description={copy.description} path="/local" />

<GameAnnouncer lastAction={controller.lastAction} {status} {playerName} />

<h1 class="sr-only">{copy.heading}</h1>

<div bind:this={tabletopBackground} class="h-full min-h-full">
  <TabletopShell
    orientation="shared"
    compactRails={status.phase !== "placement"}
  >
    {#snippet topRail()}
      <PlayerRail
        player={seating.top}
        {status}
        name={playerName(seating.top)}
        railState={railStateFor(status, seating.top)}
        instruction={instructionKeyFor(status, seating.top, orientation)}
        rotate={seating.rotateTop}
        onResign={resignOwner === seating.top
          ? () => requestResign(seating.top)
          : null}
      />
    {/snippet}

    {#snippet board()}
      <div class="relative h-full w-full">
        <Board
          state={controller.state}
          selected={controller.selected}
          lastAction={controller.lastAction}
          invalidNonce={controller.invalidNonce}
          interactive
          onSelectPoint={(point) => controller.clickPoint(point)}
        />

        <GameActionsMenu
          label={copy.tabletop.moreActions}
          closeLabel={copy.tabletop.cancel}
        >
          <GameDetailsPanel {status} {playerName}>
            {#snippet actions()}
              <Button ariaPressed={soundEnabled} onclick={toggleSound}>
                {#if soundEnabled}
                  <Volume2 size={16} aria-hidden="true" />
                  {copy.controls.soundOff}
                {:else}
                  <VolumeX size={16} aria-hidden="true" />
                  {copy.controls.soundOn}
                {/if}
              </Button>
              <Button onclick={requestNewGame}>
                <RotateCcw size={16} aria-hidden="true" />
                {copy.controls.newGame}
              </Button>
            {/snippet}
          </GameDetailsPanel>
        </GameActionsMenu>

        {#if status.isSpaceMaking}
          <BoardNotice
            title={copy.tabletop.instructions.makeSpace}
            body={copy.blockedPrompt}
            sided
            testId="blocked-prompt"
          />
        {/if}

        {#if invalidMessage !== null}
          <InvalidToast message={invalidMessage} testId="invalid-feedback" />
        {/if}

        {#if status.phase === "gameOver"}
          <GameResultOverlay
            {status}
            {playerName}
            reason={status.endReason === null
              ? null
              : copy.result.reasons[status.endReason]}
            testId="game-result"
            orientation="shared"
            onNewGame={() => controller.startNewGame()}
          />
        {/if}
      </div>
    {/snippet}

    {#snippet bottomRail()}
      <PlayerRail
        player={seating.bottom}
        {status}
        name={playerName(seating.bottom)}
        railState={railStateFor(status, seating.bottom)}
        instruction={instructionKeyFor(status, seating.bottom, orientation)}
        onResign={resignOwner === seating.bottom
          ? () => requestResign(seating.bottom)
          : null}
      />
    {/snippet}

    {#snippet details()}
      <GameDetailsPanel {status} {playerName}>
        {#snippet actions()}
          <Button ariaPressed={soundEnabled} onclick={toggleSound}>
            {#if soundEnabled}
              <Volume2 size={16} aria-hidden="true" />
              {copy.controls.soundOff}
            {:else}
              <VolumeX size={16} aria-hidden="true" />
              {copy.controls.soundOn}
            {/if}
          </Button>
          <Button onclick={requestNewGame}>
            <RotateCcw size={16} aria-hidden="true" />
            {copy.controls.newGame}
          </Button>
        {/snippet}
      </GameDetailsPanel>
    {/snippet}
  </TabletopShell>
</div>

<ConfirmSheet
  open={pendingConfirm !== null}
  title={pendingConfirm === "resign"
    ? copy.controls.resign
    : copy.controls.newGame}
  body={pendingConfirm === "resign"
    ? copy.prompts.resign
    : copy.prompts.newGame}
  cancelLabel={copy.tabletop.cancel}
  confirmLabel={copy.tabletop.confirm}
  edge={confirmEdge}
  background={tabletopBackground}
  onClose={() => (pendingConfirm = null)}
  onConfirm={confirmAction}
/>
