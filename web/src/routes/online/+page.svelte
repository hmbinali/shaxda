<script lang="ts">
  import {
    Clipboard,
    Flag,
    LogOut,
    Plus,
    Trophy,
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
  import GameAnnouncer from "$components/game/GameAnnouncer.svelte";
  import GameResultCard from "$components/game/GameResultCard.svelte";
  import GameStatusPanel from "$components/game/GameStatusPanel.svelte";
  import PlayerPiecesCard from "$components/game/PlayerPiecesCard.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import Button from "$components/ui/Button.svelte";
  import {
    getOrCreateGuestId,
    loadGuestDisplayName,
    saveGuestDisplayName,
  } from "$lib/online/guestIdentity";
  import { OnlineCreateRoomError } from "$lib/online/onlineGameClient";
  import { createOnlineGameController } from "$lib/online/onlineGame.svelte";

  type TurnstileApi = {
    render: (
      container: HTMLElement,
      options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
      },
    ) => string;
    reset: (widgetId?: string) => void;
    remove?: (widgetId: string) => void;
  };

  const copy = messages.so.onlineGame;
  const gameCopy = messages.so.localGame;
  const controller = createOnlineGameController();
  const soundPlayer = new SoundPlayer();

  let guestId = $state("");
  let displayName = $state("");
  let roomCodeInput = $state("");
  let pageOrigin = $state("");
  let busy = $state(false);
  let formError = $state<string | null>(null);
  let copied = $state(false);
  let soundEnabled = $state(true);
  let lastFeedbackNonce = 0;
  let turnstileToken = $state<string | undefined>();
  let turnstileContainer = $state<HTMLDivElement | null>(null);
  let turnstileWidgetId: string | undefined;

  const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const turnstileRequired = $derived(turnstileSiteKey.length > 0);

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
      if (roomCodeInput.length > 0 && displayName.trim().length > 0) {
        controller.joinRoom(roomCodeInput, guestId, displayName);
      }
    }

    void renderTurnstile();

    return () => {
      if (turnstileWidgetId && window.turnstile?.remove) {
        window.turnstile.remove(turnstileWidgetId);
      }
    };
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

    if (turnstileRequired && !turnstileToken) {
      formError = copy.errors.turnstileFailed;
      return;
    }

    busy = true;
    formError = null;
    saveGuestDisplayName(displayName);

    try {
      const roomCode = await controller.createRoom(
        guestId,
        displayName,
        turnstileToken,
      );
      roomCodeInput = roomCode;
      replaceState(resolve(`/online?room=${roomCode}`), {});
    } catch (error) {
      formError =
        error instanceof OnlineCreateRoomError
          ? errorMessage(error.code)
          : copy.errors.createFailed;
      resetTurnstile();
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

  async function renderTurnstile(): Promise<void> {
    if (!turnstileRequired || turnstileContainer === null) {
      return;
    }

    const turnstile = await loadTurnstile();
    if (!turnstile || turnstileWidgetId) {
      return;
    }

    turnstileWidgetId = turnstile.render(turnstileContainer, {
      sitekey: turnstileSiteKey,
      callback: (token) => {
        turnstileToken = token;
      },
      "expired-callback": () => {
        turnstileToken = undefined;
      },
      "error-callback": () => {
        turnstileToken = undefined;
        formError = copy.errors.turnstileFailed;
      },
    });
  }

  function resetTurnstile(): void {
    turnstileToken = undefined;
    if (turnstileWidgetId) {
      window.turnstile?.reset(turnstileWidgetId);
    }
  }

  async function loadTurnstile(): Promise<TurnstileApi | undefined> {
    if (window.turnstile) {
      return window.turnstile;
    }

    await new Promise<void>((resolveScript) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]',
      );
      if (existing) {
        existing.addEventListener("load", () => resolveScript(), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", () => resolveScript(), { once: true });
      script.addEventListener("error", () => resolveScript(), { once: true });
      document.head.append(script);
    });

    return window.turnstile;
  }

  function onlineResultReason(): string | null {
    if (controller.onlineEndReason === null || status.winner === null) {
      return null;
    }

    const perspective =
      status.winner === controller.mySlot ? "winner" : "loser";
    return copy.result.reasons[controller.onlineEndReason][perspective];
  }
</script>

<PageMeta title={copy.title} description={copy.description} path="/online" />

<GameAnnouncer
  lastAction={controller.lastAction}
  {status}
  {playerName}
  stateSyncNonce={controller.stateSyncNonce}
/>

<section
  class="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8"
  data-testid="online-page"
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

      <div class="flex flex-wrap gap-2">
        <Button ariaPressed={soundEnabled} onclick={toggleSound}>
          {#if soundEnabled}
            <Volume2 size={16} aria-hidden="true" />
            {gameCopy.controls.soundOff}
          {:else}
            <VolumeX size={16} aria-hidden="true" />
            {gameCopy.controls.soundOn}
          {/if}
        </Button>
        {#if controller.roomCode !== null}
          <Button onclick={leaveRoom}>
            <LogOut size={16} aria-hidden="true" />
            {copy.leave}
          </Button>
          <Button
            variant="primary"
            disabled={controller.state.phase === "gameOver"}
            onclick={() => controller.resign()}
          >
            <Flag size={16} aria-hidden="true" />
            {gameCopy.controls.resign}
          </Button>
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

    {#if controller.connectionStatus === "reconnecting"}
      <p
        class="mb-3 rounded border border-amber-700/25 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
        role="status"
      >
        {copy.notices.reconnecting}
      </p>
    {/if}

    {#if controller.started && controller.opponentConnected === false && controller.state.phase !== "gameOver"}
      <p
        class="mb-3 rounded border border-amber-700/25 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
        role="status"
      >
        {copy.notices.opponentDisconnected}
      </p>
    {/if}

    {#if controller.isIdlePlayer && controller.state.phase !== "gameOver"}
      <p
        class="mb-3 rounded border border-board-700/25 bg-white/70 px-3 py-2 text-sm font-medium text-board-900"
        role="status"
      >
        {copy.notices.idleNudge}
      </p>
    {/if}

    {#if controller.canClaimWin}
      <div
        class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded border border-green-700/25 bg-green-50 px-3 py-2 text-sm font-medium text-green-900"
        role="status"
      >
        <span>{copy.notices.claimAvailable}</span>
        <Button
          variant="success"
          size="compact"
          onclick={() => controller.claimWin()}
        >
          <Trophy size={16} aria-hidden="true" />
          {copy.claimWin}
        </Button>
      </div>
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

          {#if turnstileRequired}
            <div bind:this={turnstileContainer}></div>
          {/if}

          <div class="flex flex-wrap gap-2">
            <Button
              variant="primary"
              type="submit"
              disabled={busy ||
                guestId.length === 0 ||
                (turnstileRequired && !turnstileToken)}
              testId="create-room"
            >
              <Plus size={16} aria-hidden="true" />
              {copy.createRoom}
            </Button>
            <Button
              disabled={busy || guestId.length === 0}
              onclick={joinRoom}
              testId="join-room"
            >
              {copy.joinRoom}
            </Button>
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
              <Button size="compact" onclick={() => void copyShareLink()}>
                <Clipboard size={16} aria-hidden="true" />
                {copied ? copy.copied : copy.copyLink}
              </Button>
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
    <GameStatusPanel
      {status}
      {playerName}
      leadingFields={[
        {
          label: copy.connectionLabel,
          value: copy.connection[controller.connectionStatus],
        },
        ...(controller.roomCode === null
          ? []
          : [
              {
                label: copy.roomLabel,
                value: controller.roomCode,
                monospaced: true,
              },
            ]),
      ]}
      showFirstAdvantage={false}
      showTurnsSinceCapture={false}
    />

    <PlayerPiecesCard
      {status}
      playerName={(player) =>
        controller.presence[player] === null
          ? copy.emptySlot
          : playerSeatLabel(player)}
    />

    {#if status.phase === "gameOver"}
      <GameResultCard
        {status}
        {playerName}
        reason={controller.onlineEndReason !== null
          ? onlineResultReason()
          : status.endReason === null
            ? null
            : gameCopy.result.reasons[status.endReason]}
        testId="online-game-result"
      />
    {/if}
  </aside>
</section>
