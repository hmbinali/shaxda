<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { Flag, LogOut, RotateCcw, Volume2, VolumeX } from "@lucide/svelte";
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
  import ConfirmDialog from "$components/game/ConfirmDialog.svelte";
  import GameAnnouncer from "$components/game/GameAnnouncer.svelte";
  import GameResultOverlay from "$components/game/GameResultOverlay.svelte";
  import InvalidToast from "$components/game/InvalidToast.svelte";
  import PlayerRail from "$components/game/PlayerRail.svelte";
  import TabletopShell from "$components/game/TabletopShell.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import { createLocalGameController } from "$lib/game/localGame.svelte";
  import {
    instructionKeyFor,
    railStateFor,
    resolveSeating,
  } from "$lib/game/seating";
  import { registerTopBarActions } from "$lib/shell/appShell.svelte";

  const copy = messages.so.localGame;
  const orientation = { orientation: "shared" } as const;
  const seating = resolveSeating(orientation);
  const controller = createLocalGameController();
  const soundPlayer = new SoundPlayer();

  let soundEnabled = $state(true);
  let lastFeedbackNonce = 0;
  let pendingConfirm = $state<"newGame" | "resign" | "exit" | null>(null);
  let tabletopBackground = $state<HTMLElement | null>(null);
  const status = $derived(controller.status);
  const resignOwner = $derived(findResignOwner(controller.state));
  const invalidMessage = $derived(
    controller.invalid === null
      ? null
      : copy.invalid[controller.invalid.reason],
  );

  registerTopBarActions(() => [
    {
      id: "sound",
      label: soundEnabled ? copy.controls.soundOff : copy.controls.soundOn,
      icon: soundEnabled ? Volume2 : VolumeX,
      onSelect: toggleSound,
      pressed: soundEnabled,
    },
    {
      id: "new-game",
      label: copy.controls.newGame,
      icon: RotateCcw,
      onSelect: requestNewGame,
    },
    {
      id: "resign-or-exit",
      label: resignOwner === null ? copy.controls.exit : copy.controls.resign,
      icon: resignOwner === null ? LogOut : Flag,
      onSelect: () => {
        if (resignOwner === null) {
          requestExit();
        } else {
          requestResign();
        }
      },
      tone: resignOwner === null ? "default" : "danger",
    },
  ]);

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
  }

  function requestResign(): void {
    pendingConfirm = "resign";
  }

  function requestExit(): void {
    pendingConfirm = "exit";
  }

  function confirmAction(): void {
    const action = pendingConfirm;
    pendingConfirm = null;

    if (action === "newGame") {
      controller.startNewGame();
    } else if (action === "resign") {
      controller.resign();
    } else if (action === "exit") {
      void goto(resolve("/"));
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
      />
    {/snippet}
  </TabletopShell>
</div>

<ConfirmDialog
  open={pendingConfirm !== null}
  title={pendingConfirm === "resign"
    ? copy.controls.resign
    : pendingConfirm === "exit"
      ? copy.controls.exit
      : copy.controls.newGame}
  body={pendingConfirm === "resign"
    ? copy.prompts.resign
    : pendingConfirm === "exit"
      ? copy.prompts.leave
      : copy.prompts.newGame}
  cancelLabel={copy.tabletop.cancel}
  confirmLabel={copy.tabletop.confirm}
  background={tabletopBackground}
  onClose={() => (pendingConfirm = null)}
  onConfirm={confirmAction}
/>
