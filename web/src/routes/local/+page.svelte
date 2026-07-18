<script lang="ts">
  import { Flag, RotateCcw, Volume2, VolumeX } from "@lucide/svelte";
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
  import PlayerPiecesCard from "$components/game/PlayerPiecesCard.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import Button from "$components/ui/Button.svelte";
  import { createLocalGameController } from "$lib/game/localGame.svelte";

  const copy = messages.so.localGame;
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

<section
  class="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8"
>
  <div>
    <div
      class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="text-sm font-semibold uppercase tracking-normal text-red-800">
          {messages.so.appName}
        </p>
        <h1 class="mt-1 text-3xl font-semibold tracking-normal sm:text-5xl">
          {copy.heading}
        </h1>
      </div>

      <div class="flex gap-2">
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
    </div>

    {#if invalidMessage !== null}
      <p
        class="mb-3 rounded border border-red-700/25 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        role="status"
        data-testid="invalid-feedback"
      >
        {invalidMessage}
      </p>
    {/if}

    <div
      class="rounded border border-board-700/20 bg-board-100/45 p-3 shadow-sm"
    >
      <Board
        state={controller.state}
        selected={controller.selected}
        lastAction={controller.lastAction}
        invalidNonce={controller.invalidNonce}
        interactive
        onSelectPoint={(point) => controller.clickPoint(point)}
      />
    </div>
  </div>

  <aside class="grid content-start gap-4">
    <GameStatusPanel {status} {playerName} blockedPrompt={copy.blockedPrompt} />

    <PlayerPiecesCard {status} {playerName} />

    {#if status.phase === "gameOver"}
      <GameResultCard
        {status}
        {playerName}
        reason={status.endReason === null
          ? null
          : copy.result.reasons[status.endReason]}
        testId="game-result"
      />
    {/if}
  </aside>
</section>
