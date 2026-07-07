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
  import PageMeta from "$components/PageMeta.svelte";
  import SiteShell from "$components/SiteShell.svelte";
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
  const players = ["A", "B"] as const;

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

<SiteShell>
  <main class="bg-board-50">
    <section
      class="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8"
    >
      <div>
        <div
          class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p
              class="text-sm font-semibold uppercase tracking-normal text-red-800"
            >
              {messages.so.appName}
            </p>
            <h1 class="mt-1 text-3xl font-semibold tracking-normal sm:text-5xl">
              {copy.heading}
            </h1>
          </div>

          <div class="flex gap-2">
            <button
              class="inline-flex items-center gap-2 rounded border border-board-700/30 bg-white/50 px-4 py-2 text-sm font-semibold text-board-900 hover:bg-board-100/65"
              type="button"
              aria-pressed={soundEnabled}
              onclick={toggleSound}
            >
              {#if soundEnabled}
                <Volume2 size={16} aria-hidden="true" />
                {copy.controls.soundOff}
              {:else}
                <VolumeX size={16} aria-hidden="true" />
                {copy.controls.soundOn}
              {/if}
            </button>
            <button
              class="inline-flex items-center gap-2 rounded border border-board-700/30 bg-white/50 px-4 py-2 text-sm font-semibold text-board-900 hover:bg-board-100/65"
              type="button"
              onclick={() => controller.startNewGame()}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {copy.controls.newGame}
            </button>
            <button
              class="inline-flex items-center gap-2 rounded bg-board-900 px-4 py-2 text-sm font-semibold text-board-50 hover:bg-board-700 disabled:cursor-not-allowed disabled:opacity-55"
              type="button"
              disabled={controller.state.phase === "gameOver"}
              onclick={() => controller.resign()}
            >
              <Flag size={16} aria-hidden="true" />
              {copy.controls.resign}
            </button>
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
        <section class="rounded border border-board-700/20 bg-white/60 p-4">
          <dl class="grid gap-3 text-sm">
            <div>
              <dt class="font-semibold text-board-900">{copy.phaseLabel}</dt>
              <dd class="mt-1 text-board-700">{copy.phases[status.phase]}</dd>
            </div>
            <div>
              <dt class="font-semibold text-board-900">{copy.turnLabel}</dt>
              <dd class="mt-1 text-board-700">
                {playerName(status.currentPlayer)}
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-board-900">{copy.actingLabel}</dt>
              <dd class="mt-1 text-board-700">
                {playerName(status.actingPlayer)}
              </dd>
            </div>
            {#if status.firstAdvantage !== null}
              <div>
                <dt class="font-semibold text-board-900">
                  {copy.firstAdvantageLabel}
                </dt>
                <dd class="mt-1 text-board-700">
                  {playerName(status.firstAdvantage)}
                </dd>
              </div>
            {/if}
            <div>
              <dt class="font-semibold text-board-900">
                {copy.turnsSinceCaptureLabel}
              </dt>
              <dd class="mt-1 text-board-700">{status.turnsSinceCapture}</dd>
            </div>
          </dl>

          {#if status.isSpaceMaking}
            <p
              class="mt-4 rounded border border-amber-700/25 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900"
              data-testid="blocked-prompt"
            >
              {copy.blockedPrompt}
            </p>
          {/if}
        </section>

        <section class="rounded border border-board-700/20 bg-white/60 p-4">
          <h2 class="text-base font-semibold tracking-normal">
            {copy.piecesLabel}
          </h2>
          <div class="mt-3 grid gap-3">
            {#each players as player (player)}
              <article
                class="rounded border border-board-700/15 bg-board-50 p-3"
              >
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

        {#if status.phase === "gameOver"}
          <section
            class="rounded border border-board-700/20 bg-board-900 p-4 text-board-50"
            data-testid="game-result"
          >
            {#if status.winner === null}
              <h2 class="text-lg font-semibold">{copy.result.drawLabel}</h2>
            {:else}
              <h2 class="text-lg font-semibold">
                {copy.result.winnerLabel}: {playerName(status.winner)}
              </h2>
            {/if}
            {#if status.endReason !== null}
              <p class="mt-2 text-sm leading-6 text-board-100">
                {copy.result.reasons[status.endReason]}
              </p>
            {/if}
          </section>
        {/if}
      </aside>
    </section>
  </main>
</SiteShell>
