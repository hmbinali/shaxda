<script lang="ts">
  import {
    Clipboard,
    Flag,
    LogOut,
    Plus,
    Volume2,
    VolumeX,
  } from "@lucide/svelte";
  import { replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
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
  import {
    getOrCreateGuestId,
    loadGuestDisplayName,
    saveGuestDisplayName,
  } from "$lib/online/guestIdentity";
  import { createOnlineGameController } from "$lib/online/onlineGame.svelte";

  const copy = messages.so.onlineGame;
  const gameCopy = messages.so.localGame;
  const controller = createOnlineGameController();
  const soundPlayer = new SoundPlayer();
  const players = ["A", "B"] as const;

  let guestId = $state("");
  let displayName = $state("");
  let roomCodeInput = $state("");
  let pageOrigin = $state("");
  let busy = $state(false);
  let formError = $state<string | null>(null);
  let copied = $state(false);
  let soundEnabled = $state(true);
  let lastFeedbackNonce = 0;

  const status = $derived(controller.status);
  const shareLink = $derived(
    controller.roomCode === null || pageOrigin.length === 0
      ? ""
      : `${pageOrigin}/online?room=${controller.roomCode}`,
  );
  const invalidMessage = $derived(resolveInvalidMessage());

  onMount(() => {
    guestId = getOrCreateGuestId();
    displayName = loadGuestDisplayName() ?? "";
    soundEnabled = loadSoundPreference();
    pageOrigin = window.location.origin;

    const linkedRoom = new URL(window.location.href).searchParams.get("room");
    if (linkedRoom !== null) {
      roomCodeInput = linkedRoom.trim().toUpperCase();
    }
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

  async function createRoom(): Promise<void> {
    if (!hasName()) {
      return;
    }

    busy = true;
    formError = null;
    saveGuestDisplayName(displayName);

    try {
      const roomCode = await controller.createRoom(guestId, displayName);
      roomCodeInput = roomCode;
      replaceState(resolve(`/online?room=${roomCode}`), {});
    } catch {
      formError = copy.errors.roomNotFound;
    } finally {
      busy = false;
    }
  }

  function joinRoom(): void {
    if (!hasName()) {
      return;
    }

    const roomCode = roomCodeInput.trim().toUpperCase();
    if (roomCode.length === 0) {
      formError = copy.errors.roomNotFound;
      return;
    }

    formError = null;
    saveGuestDisplayName(displayName);
    controller.joinRoom(roomCode, guestId, displayName);
    replaceState(resolve(`/online?room=${roomCode}`), {});
  }

  async function copyShareLink(): Promise<void> {
    if (shareLink.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      copied = true;
    } catch {
      copied = false;
    }
  }

  function leaveRoom(): void {
    controller.leave();
    roomCodeInput = "";
    replaceState(resolve("/online"), {});
  }

  function toggleSound(): void {
    soundEnabled = !soundEnabled;
    saveSoundPreference(soundEnabled);

    if (soundEnabled) {
      void soundPlayer.unlock();
    }
  }

  function hasName(): boolean {
    if (guestId.length === 0 || displayName.trim().length === 0) {
      formError = copy.nameLabel;
      return false;
    }

    return true;
  }

  function playerName(player: "A" | "B"): string {
    const name = controller.presence[player]?.displayName;
    return name && name.length > 0 ? name : gameCopy.playerNames[player];
  }

  function playerSeatLabel(player: "A" | "B"): string {
    const seat = playerName(player);
    return controller.mySlot === player ? `${seat} (${copy.youLabel})` : seat;
  }

  function resolveInvalidMessage(): string | null {
    if (controller.lastServerError !== null) {
      return errorMessage(controller.lastServerError);
    }

    return controller.invalid === null
      ? null
      : copy.invalid[controller.invalid.reason];
  }

  function errorMessage(code: string): string {
    return code in copy.errors
      ? copy.errors[code as keyof typeof copy.errors]
      : copy.invalid.actionRejected;
  }
</script>

<PageMeta title={copy.title} description={copy.description} path="/online" />

<SiteShell>
  <main class="bg-board-50" data-testid="online-page">
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

          <div class="flex flex-wrap gap-2">
            <button
              class="inline-flex items-center gap-2 rounded border border-board-700/30 bg-white/50 px-4 py-2 text-sm font-semibold text-board-900 hover:bg-board-100/65"
              type="button"
              aria-pressed={soundEnabled}
              onclick={toggleSound}
            >
              {#if soundEnabled}
                <Volume2 size={16} aria-hidden="true" />
                {gameCopy.controls.soundOff}
              {:else}
                <VolumeX size={16} aria-hidden="true" />
                {gameCopy.controls.soundOn}
              {/if}
            </button>
            {#if controller.roomCode !== null}
              <button
                class="inline-flex items-center gap-2 rounded border border-board-700/30 bg-white/50 px-4 py-2 text-sm font-semibold text-board-900 hover:bg-board-100/65"
                type="button"
                onclick={leaveRoom}
              >
                <LogOut size={16} aria-hidden="true" />
                {copy.leave}
              </button>
              <button
                class="inline-flex items-center gap-2 rounded bg-board-900 px-4 py-2 text-sm font-semibold text-board-50 hover:bg-board-700 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={controller.state.phase === "gameOver"}
                onclick={() => controller.resign()}
              >
                <Flag size={16} aria-hidden="true" />
                {gameCopy.controls.resign}
              </button>
            {/if}
          </div>
        </div>

        {#if invalidMessage !== null || formError !== null}
          <p
            class="mb-3 rounded border border-red-700/25 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            role="status"
            data-testid="online-feedback"
          >
            {formError ?? invalidMessage}
          </p>
        {/if}

        {#if controller.roomCode === null}
          <section class="rounded border border-board-700/20 bg-white/60 p-4">
            <form
              class="grid gap-4"
              onsubmit={(event) => {
                event.preventDefault();
                void createRoom();
              }}
            >
              <label class="grid gap-2 text-sm font-semibold text-board-900">
                {copy.nameLabel}
                <input
                  class="rounded border border-board-700/25 bg-white px-3 py-2 font-normal text-board-900"
                  bind:value={displayName}
                  maxlength="40"
                  placeholder={copy.form.namePlaceholder}
                />
              </label>

              <label class="grid gap-2 text-sm font-semibold text-board-900">
                {copy.roomCodeLabel}
                <input
                  class="rounded border border-board-700/25 bg-white px-3 py-2 font-mono font-normal uppercase text-board-900"
                  bind:value={roomCodeInput}
                  maxlength="32"
                  placeholder={copy.form.codePlaceholder}
                />
              </label>

              <div class="flex flex-wrap gap-2">
                <button
                  class="inline-flex items-center gap-2 rounded bg-board-900 px-4 py-2 text-sm font-semibold text-board-50 hover:bg-board-700 disabled:cursor-not-allowed disabled:opacity-55"
                  type="submit"
                  disabled={busy || guestId.length === 0}
                  data-testid="create-room"
                >
                  <Plus size={16} aria-hidden="true" />
                  {copy.createRoom}
                </button>
                <button
                  class="inline-flex items-center gap-2 rounded border border-board-700/30 bg-white/50 px-4 py-2 text-sm font-semibold text-board-900 hover:bg-board-100/65 disabled:cursor-not-allowed disabled:opacity-55"
                  type="button"
                  disabled={busy || guestId.length === 0}
                  onclick={joinRoom}
                  data-testid="join-room"
                >
                  {copy.joinRoom}
                </button>
              </div>
            </form>
          </section>
        {:else if !controller.started}
          <section
            class="rounded border border-board-700/20 bg-white/60 p-4"
            data-testid="online-lobby"
          >
            <p class="text-lg font-semibold text-board-900">{copy.waiting}</p>
            <p class="mt-2 font-mono text-sm text-board-700">
              {controller.roomCode}
            </p>
            {#if shareLink.length > 0}
              <div class="mt-4 grid gap-2">
                <span class="text-sm font-semibold text-board-900">
                  {copy.shareLabel}
                </span>
                <div class="flex gap-2">
                  <input
                    class="min-w-0 flex-1 rounded border border-board-700/25 bg-white px-3 py-2 text-sm text-board-900"
                    readonly
                    value={shareLink}
                    data-testid="share-link"
                  />
                  <button
                    class="inline-flex items-center gap-2 rounded border border-board-700/30 bg-white/50 px-3 py-2 text-sm font-semibold text-board-900 hover:bg-board-100/65"
                    type="button"
                    onclick={() => void copyShareLink()}
                  >
                    <Clipboard size={16} aria-hidden="true" />
                    {copied ? copy.copied : copy.copyLink}
                  </button>
                </div>
              </div>
            {/if}
          </section>
        {:else}
          <div
            class="rounded border border-board-700/20 bg-board-100/45 p-3 shadow-sm"
            data-testid="online-board"
          >
            <Board
              state={controller.state}
              selected={controller.selected}
              lastAction={controller.lastAction}
              invalidNonce={controller.invalidNonce}
              interactive={controller.canInteract}
              onSelectPoint={(point) => controller.clickPoint(point)}
            />
          </div>
        {/if}
      </div>

      <aside class="grid content-start gap-4">
        <section class="rounded border border-board-700/20 bg-white/60 p-4">
          <dl class="grid gap-3 text-sm">
            <div>
              <dt class="font-semibold text-board-900">
                {copy.connectionLabel}
              </dt>
              <dd class="mt-1 text-board-700">
                {copy.connection[controller.connectionStatus]}
              </dd>
            </div>
            {#if controller.roomCode !== null}
              <div>
                <dt class="font-semibold text-board-900">{copy.roomLabel}</dt>
                <dd class="mt-1 font-mono text-board-700">
                  {controller.roomCode}
                </dd>
              </div>
            {/if}
            <div>
              <dt class="font-semibold text-board-900">
                {gameCopy.phaseLabel}
              </dt>
              <dd class="mt-1 text-board-700">
                {gameCopy.phases[status.phase]}
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-board-900">{gameCopy.turnLabel}</dt>
              <dd class="mt-1 text-board-700">
                {playerName(status.currentPlayer)}
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-board-900">
                {gameCopy.actingLabel}
              </dt>
              <dd class="mt-1 text-board-700">
                {playerName(status.actingPlayer)}
              </dd>
            </div>
          </dl>
        </section>

        <section class="rounded border border-board-700/20 bg-white/60 p-4">
          <h2 class="text-base font-semibold tracking-normal">
            {gameCopy.piecesLabel}
          </h2>
          <div class="mt-3 grid gap-3">
            {#each players as player (player)}
              <article
                class="rounded border border-board-700/15 bg-board-50 p-3"
              >
                <h3 class="font-semibold">
                  {controller.presence[player] === null
                    ? copy.emptySlot
                    : playerSeatLabel(player)}
                </h3>
                <dl class="mt-2 grid grid-cols-3 gap-2 text-sm text-board-700">
                  <div>
                    <dt>{gameCopy.inHandLabel}</dt>
                    <dd class="font-semibold text-board-900">
                      {status.players[player].inHand}
                    </dd>
                  </div>
                  <div>
                    <dt>{gameCopy.onBoardLabel}</dt>
                    <dd class="font-semibold text-board-900">
                      {status.players[player].onBoard}
                    </dd>
                  </div>
                  <div>
                    <dt>{gameCopy.capturedLabel}</dt>
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
            data-testid="online-game-result"
          >
            {#if status.winner === null}
              <h2 class="text-lg font-semibold">{gameCopy.result.drawLabel}</h2>
            {:else}
              <h2 class="text-lg font-semibold">
                {gameCopy.result.winnerLabel}: {playerName(status.winner)}
              </h2>
            {/if}
            {#if status.endReason !== null}
              <p class="mt-2 text-sm leading-6 text-board-100">
                {gameCopy.result.reasons[status.endReason]}
              </p>
            {/if}
          </section>
        {/if}
      </aside>
    </section>
  </main>
</SiteShell>
