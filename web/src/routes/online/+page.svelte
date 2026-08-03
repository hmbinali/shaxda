<script lang="ts">
  import {
    Clipboard,
    Flag,
    LogOut,
    Plus,
    Volume2,
    VolumeX,
  } from "@lucide/svelte";
  import { goto, replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { messages } from "@shaxda/i18n";
  import { onMount } from "svelte";
  import {
    getSoundPlayer,
    loadSoundPreference,
    saveSoundPreference,
  } from "$lib/audio/sound";
  import ConfirmDialog from "$components/game/ConfirmDialog.svelte";
  import GameAnnouncer from "$components/game/GameAnnouncer.svelte";
  import GameStatusPanel from "$components/game/GameStatusPanel.svelte";
  import OnlineTabletop from "$components/game/OnlineTabletop.svelte";
  import PlayerPiecesCard from "$components/game/PlayerPiecesCard.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import Button from "$components/ui/Button.svelte";
  import NoticeBanner from "$components/ui/NoticeBanner.svelte";
  import {
    getOrCreateGuestId,
    loadGuestDisplayName,
    saveGuestDisplayName,
  } from "$lib/online/guestIdentity";
  import { OnlineCreateRoomError } from "$lib/online/onlineGameClient";
  import { createOnlineGameController } from "$lib/online/onlineGame.svelte";
  import { createTransientToast } from "$lib/notices/toast.svelte";
  import { registerTopBarActions } from "$lib/shell/appShell.svelte";

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
  const soundPlayer = getSoundPlayer();
  const toast = createTransientToast();

  let guestId = $state("");
  let displayName = $state("");
  let roomCodeInput = $state("");
  let pageOrigin = $state("");
  let busy = $state(false);
  let copied = $state(false);
  let soundEnabled = $state(true);
  let pendingConfirm = $state<"resign" | "leave" | null>(null);
  let pageBackground = $state<HTMLElement | null>(null);
  let nameInput = $state<HTMLInputElement | null>(null);
  let lastFeedbackNonce = 0;
  let lastInvalidNonce = 0;
  let wasStarted = false;
  let turnstileToken = $state<string | undefined>();
  let turnstileContainer = $state<HTMLDivElement | null>(null);
  let turnstileWidgetId: string | undefined;
  let turnstileLoading: Promise<TurnstileApi | undefined> | null = null;
  let copyTimeout: number | undefined;

  const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const turnstileRequired = $derived(turnstileSiteKey.length > 0);

  const status = $derived(controller.status);
  const shareLink = $derived(
    controller.roomCode === null || pageOrigin.length === 0
      ? ""
      : `${pageOrigin}/online?room=${controller.roomCode}`,
  );
  const hasInviteCode = $derived(roomCodeInput.trim().length > 0);
  const lobbyNotice = $derived(resolveLobbyNotice());

  registerTopBarActions(() => {
    const liveGame =
      controller.started &&
      controller.mySlot !== null &&
      status.phase !== "gameOver";

    return [
      {
        id: "sound",
        label: soundEnabled
          ? gameCopy.controls.soundOff
          : gameCopy.controls.soundOn,
        icon: soundEnabled ? Volume2 : VolumeX,
        onSelect: toggleSound,
        pressed: soundEnabled,
      },
      {
        id: "resign-or-exit",
        label: liveGame ? gameCopy.controls.resign : gameCopy.controls.exit,
        icon: liveGame ? Flag : LogOut,
        onSelect: () => {
          if (liveGame) {
            pendingConfirm = "resign";
          } else if (controller.roomCode === null) {
            void goto(resolve("/"));
          } else {
            pendingConfirm = "leave";
          }
        },
        tone: liveGame ? "danger" : "default",
      },
    ];
  });

  onMount(() => {
    guestId = getOrCreateGuestId();
    displayName = loadGuestDisplayName() ?? "";
    soundEnabled = loadSoundPreference();
    void soundPlayer.preload();
    pageOrigin = window.location.origin;

    const linkedRoom = new URL(window.location.href).searchParams.get("room");
    if (linkedRoom !== null) {
      roomCodeInput = linkedRoom.trim().toUpperCase();
      if (roomCodeInput.length > 0 && displayName.trim().length > 0) {
        controller.joinRoom(roomCodeInput, guestId, displayName);
      }
    }

    return () => {
      if (copyTimeout !== undefined) {
        window.clearTimeout(copyTimeout);
      }
    };
  });

  $effect(() => {
    const container = turnstileContainer;
    if (!turnstileRequired || container === null) {
      return;
    }

    let cancelled = false;
    let renderedWidgetId: string | undefined;
    void loadTurnstile().then((turnstile) => {
      if (
        cancelled ||
        turnstile === undefined ||
        turnstileContainer !== container
      ) {
        return;
      }

      renderedWidgetId = turnstile.render(container, {
        sitekey: turnstileSiteKey,
        callback: (token) => {
          if (!cancelled) turnstileToken = token;
        },
        "expired-callback": () => {
          if (!cancelled) turnstileToken = undefined;
        },
        "error-callback": () => {
          if (!cancelled) {
            turnstileToken = undefined;
            toast.show(copy.errors.turnstileFailed);
          }
        },
      });
      turnstileWidgetId = renderedWidgetId;
    });

    return () => {
      cancelled = true;
      if (renderedWidgetId !== undefined) {
        window.turnstile?.remove?.(renderedWidgetId);
      }
      if (turnstileWidgetId === renderedWidgetId) {
        turnstileWidgetId = undefined;
      }
      turnstileToken = undefined;
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

  $effect(() => {
    const invalid = controller.invalid;
    if (invalid === null || invalid.nonce === lastInvalidNonce) {
      return;
    }

    lastInvalidNonce = invalid.nonce;
    toast.show(
      controller.lastServerError === null
        ? copy.invalid[invalid.reason]
        : errorMessage(controller.lastServerError),
    );
  });

  $effect(() => {
    const started = controller.started;
    if (started && !wasStarted) {
      toast.clear();
    }
    wasStarted = started;
  });

  async function createRoom(): Promise<void> {
    if (!hasName()) {
      return;
    }

    if (turnstileRequired && !turnstileToken) {
      toast.show(copy.errors.turnstileFailed);
      return;
    }

    busy = true;
    toast.clear();
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
      toast.show(
        error instanceof OnlineCreateRoomError
          ? errorMessage(error.code)
          : copy.errors.createFailed,
      );
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
      toast.show(copy.errors.roomNotFound);
      return;
    }

    toast.clear();
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
      if (copyTimeout !== undefined) {
        window.clearTimeout(copyTimeout);
      }
      copyTimeout = window.setTimeout(() => {
        copied = false;
        copyTimeout = undefined;
      }, 2_000);
    } catch {
      copied = false;
    }
  }

  function leaveRoom(): void {
    controller.leave();
    roomCodeInput = "";
    toast.clear();
    replaceState(resolve("/online"), {});
  }

  function confirmPendingAction(): void {
    const action = pendingConfirm;
    pendingConfirm = null;

    if (action === "resign") {
      controller.resign();
    } else if (action === "leave") {
      leaveRoom();
    }
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
      toast.show(copy.errors.nameRequired);
      nameInput?.focus();
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

  function errorMessage(code: string): string {
    return code in copy.errors
      ? copy.errors[code as keyof typeof copy.errors]
      : copy.invalid.actionRejected;
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

    turnstileLoading ??= new Promise<void>((resolveScript) => {
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
    }).then(() => window.turnstile);

    return turnstileLoading;
  }

  function resolveLobbyNotice(): {
    tone: "warning" | "info";
    message: string;
  } | null {
    if (controller.connectionStatus === "reconnecting") {
      return { tone: "warning", message: copy.notices.reconnecting };
    }
    if (
      controller.started &&
      controller.opponentConnected === false &&
      status.phase !== "gameOver"
    ) {
      return { tone: "warning", message: copy.notices.opponentDisconnected };
    }
    if (controller.isIdlePlayer && status.phase !== "gameOver") {
      return { tone: "info", message: copy.notices.idleNudge };
    }
    return null;
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

<div bind:this={pageBackground} class="h-full min-h-full">
  {#if controller.started && controller.mySlot !== null}
    <OnlineTabletop
      {controller}
      viewer={controller.mySlot}
      toast={toast.current}
      {playerName}
      resultReason={controller.onlineEndReason !== null
        ? onlineResultReason()
        : status.endReason === null
          ? null
          : gameCopy.result.reasons[status.endReason]}
      onLeave={leaveRoom}
    />
  {:else}
    <section
      class="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8"
      data-testid="online-page"
    >
      <div>
        <div
          class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p class="text-sm font-semibold uppercase text-red-800">
              {messages.so.appName}
            </p>
            <h1 class="mt-1 text-3xl font-semibold sm:text-5xl">
              {copy.heading}
            </h1>
          </div>
        </div>

        {#if toast.current !== null}
          {#key toast.current.nonce}
            <NoticeBanner tone="danger" class="mb-3" testId="online-feedback">
              {toast.current.message}
            </NoticeBanner>
          {/key}
        {/if}

        {#if lobbyNotice !== null}
          <NoticeBanner tone={lobbyNotice.tone} class="mb-3">
            {lobbyNotice.message}
          </NoticeBanner>
        {/if}

        {#if controller.roomCode === null}
          <section
            class="rounded-lg border border-board-700/20 bg-white/60 p-4"
          >
            <form
              class="grid gap-4"
              onsubmit={(event) => {
                event.preventDefault();
                if (hasInviteCode) {
                  joinRoom();
                } else {
                  void createRoom();
                }
              }}
            >
              <label class="grid gap-2 text-sm font-semibold text-board-900">
                {copy.nameLabel}
                <input
                  bind:this={nameInput}
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
                {#if hasInviteCode}
                  <Button
                    variant="primary"
                    disabled={busy || guestId.length === 0}
                    onclick={joinRoom}
                    testId="join-room"
                  >
                    {busy ? copy.form.busy : copy.joinRoom}
                  </Button>
                {/if}
                <Button
                  variant={hasInviteCode ? "outline" : "primary"}
                  disabled={busy ||
                    guestId.length === 0 ||
                    (turnstileRequired && !turnstileToken)}
                  onclick={() => void createRoom()}
                  testId="create-room"
                >
                  <Plus size={16} aria-hidden="true" />
                  {busy ? copy.form.busy : copy.createRoom}
                </Button>
                {#if !hasInviteCode}
                  <Button
                    disabled={busy || guestId.length === 0}
                    onclick={joinRoom}
                    testId="join-room"
                  >
                    {busy ? copy.form.busy : copy.joinRoom}
                  </Button>
                {/if}
              </div>
            </form>
          </section>
        {:else if !controller.started || controller.mySlot === null}
          <section
            class="rounded-lg border border-board-700/20 bg-white/60 p-4"
            data-testid="online-lobby"
          >
            <p class="text-lg font-semibold text-board-900">
              {controller.connectionStatus === "connected"
                ? copy.waiting
                : copy.connection[controller.connectionStatus]}
            </p>
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
          showGameFields={controller.started}
        />

        <PlayerPiecesCard
          {status}
          playerName={(player) =>
            controller.presence[player] === null
              ? copy.emptySlot
              : playerSeatLabel(player)}
        />
      </aside>
    </section>
  {/if}
</div>

<ConfirmDialog
  open={pendingConfirm !== null}
  title={pendingConfirm === "resign"
    ? gameCopy.controls.resign
    : gameCopy.controls.exit}
  body={pendingConfirm === "resign"
    ? gameCopy.prompts.resign
    : gameCopy.prompts.leave}
  cancelLabel={gameCopy.tabletop.cancel}
  confirmLabel={gameCopy.tabletop.confirm}
  background={pageBackground}
  onClose={() => (pendingConfirm = null)}
  onConfirm={confirmPendingAction}
/>
