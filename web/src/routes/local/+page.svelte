<script lang="ts">
  import { Ellipsis, Flag, RotateCcw, Volume2, VolumeX } from "@lucide/svelte";
  import { messages } from "@shaxda/i18n";
  import { onMount } from "svelte";
  import {
    SoundPlayer,
    loadSoundPreference,
    saveSoundPreference,
  } from "$lib/audio/sound";
  import Board from "$components/Board.svelte";
  import GameAnnouncer from "$components/game/GameAnnouncer.svelte";
  import GameResultCard from "$components/game/GameResultCard.svelte";
  import GameStatusPanel from "$components/game/GameStatusPanel.svelte";
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
  const controller = createLocalGameController({
    confirmNewGame: () => window.confirm(copy.prompts.newGame),
  });
  const soundPlayer = new SoundPlayer();

  let soundEnabled = $state(true);
  let lastFeedbackNonce = 0;
  const status = $derived(controller.status);
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

  function playerName(player: "A" | "B"): string {
    return copy.playerNames[player];
  }

  function toggleSound(): void {
    soundEnabled = !soundEnabled;
    saveSoundPreference(soundEnabled);

    if (soundEnabled) {
      void soundPlayer.unlock();
    }
  }
</script>

<PageMeta title={copy.title} description={copy.description} path="/local" />

<GameAnnouncer lastAction={controller.lastAction} {status} {playerName} />

<h1 class="sr-only">{copy.heading}</h1>

<div class="h-full min-h-full">
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

        <details class="mobile-actions">
          <summary aria-label={copy.tabletop.moreActions}>
            <Ellipsis size={22} aria-hidden="true" />
          </summary>
          <div class="action-popover">
            <Button ariaPressed={soundEnabled} onclick={toggleSound}>
              {#if soundEnabled}
                <Volume2 size={16} aria-hidden="true" />
                {copy.controls.soundOff}
              {:else}
                <VolumeX size={16} aria-hidden="true" />
                {copy.controls.soundOn}
              {/if}
            </Button>
            <Button onclick={() => controller.startNewGame()}>
              <RotateCcw size={16} aria-hidden="true" />
              {copy.controls.newGame}
            </Button>
            <Button
              variant="primary"
              disabled={controller.state.phase === "gameOver"}
              onclick={() => controller.resign()}
            >
              <Flag size={16} aria-hidden="true" />
              {copy.controls.resign}
            </Button>
          </div>
        </details>

        {#if invalidMessage !== null}
          <p
            class="pointer-events-none absolute inset-x-3 bottom-3 z-20 rounded border border-red-700/25 bg-red-50/95 px-3 py-2 text-center text-sm font-medium text-red-800 shadow"
            role="status"
            data-testid="invalid-feedback"
          >
            {invalidMessage}
          </p>
        {/if}

        {#if status.phase === "gameOver"}
          <div
            class="absolute inset-0 z-10 grid place-items-center bg-board-900/35 p-4"
          >
            <GameResultCard
              {status}
              {playerName}
              reason={status.endReason === null
                ? null
                : copy.result.reasons[status.endReason]}
              testId="game-result"
            />
          </div>
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

    {#snippet details()}
      <GameStatusPanel
        {status}
        {playerName}
        blockedPrompt={copy.blockedPrompt}
      />

      <div
        class="grid gap-2 rounded border border-board-700/20 bg-white/60 p-4"
      >
        <Button ariaPressed={soundEnabled} onclick={toggleSound}>
          {#if soundEnabled}
            <Volume2 size={16} aria-hidden="true" />
            {copy.controls.soundOff}
          {:else}
            <VolumeX size={16} aria-hidden="true" />
            {copy.controls.soundOn}
          {/if}
        </Button>
        <Button onclick={() => controller.startNewGame()}>
          <RotateCcw size={16} aria-hidden="true" />
          {copy.controls.newGame}
        </Button>
        <Button
          variant="primary"
          disabled={controller.state.phase === "gameOver"}
          onclick={() => controller.resign()}
        >
          <Flag size={16} aria-hidden="true" />
          {copy.controls.resign}
        </Button>
      </div>
    {/snippet}
  </TabletopShell>
</div>

<style>
  .mobile-actions {
    position: absolute;
    z-index: 30;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .mobile-actions summary {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    cursor: pointer;
    list-style: none;
    place-items: center;
    border: 1px solid rgb(106 61 37 / 0.3);
    border-radius: 999px;
    background: rgb(255 250 243 / 0.92);
    color: #2e2019;
    box-shadow: 0 4px 14px rgb(68 38 22 / 0.16);
  }

  .mobile-actions summary::-webkit-details-marker {
    display: none;
  }

  .action-popover {
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 50%;
    display: grid;
    width: max-content;
    gap: 0.35rem;
    transform: translateX(-50%);
    border: 1px solid rgb(106 61 37 / 0.24);
    border-radius: 0.75rem;
    background: #fffaf3;
    padding: 0.5rem;
    box-shadow: 0 10px 30px rgb(68 38 22 / 0.2);
  }

  @media (min-width: 64rem) {
    .mobile-actions {
      display: none;
    }
  }
</style>
