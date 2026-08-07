<script lang="ts">
  import {
    Clipboard,
    Flag,
    LogOut,
    Menu,
    Plus,
    Volume2,
    VolumeX,
  } from "@lucide/svelte";
  import { goto, replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { messages, siteContent } from "@shaxda/i18n";
  import { onMount } from "svelte";
  import {
    getSoundPlayer,
    loadSoundPreference,
    saveSoundPreference,
  } from "$lib/audio/sound";
  import ConfirmDialog from "$components/game/ConfirmDialog.svelte";
  import Avatar from "$components/account/Avatar.svelte";
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
  import { createOnlineIdentity } from "$lib/online/identity.svelte";
  import { createOnlineGameController } from "$lib/online/onlineGame.svelte";
  import { createTransientToast } from "$lib/notices/toast.svelte";
  import { registerTopBar } from "$lib/shell/appShell.svelte";
  import { pagesGroup } from "$lib/shell/topBarConfig";

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
  const identity = createOnlineIdentity();
  const soundPlayer = getSoundPlayer();
  const toast = createTransientToast();
  const topBarCopy = siteContent.so.topBar;

  let guestId = $state("");
  let displayName = $state("");
  let roomCodeInput = $state("");
  let pageOrigin = $state("");
  let busy = $state(false);
  let copied = $state(false);
  let soundEnabled = $state(true);
  let pendingConfirm = $state<"resign" | "leave" | "home" | null>(null);
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
  let guestFallbackAllowed = $state(false);
  let returnTo = $state("/online");

  const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const turnstileRequired = $derived(turnstileSiteKey.length > 0);

  const status = $derived(controller.status);
  const shareLink = $derived(
    controller.roomCode === null || pageOrigin.length === 0
      ? ""
      : `${pageOrigin}/online?room=${controller.roomCode}`,
  );
  const hasInviteCode = $derived(roomCodeInput.trim().length > 0);
  const identityUsesAccount = $derived(identity.status === "complete");
  const guestFormAvailable = $derived(
    identity.status === "signedOut" ||
      identity.status === "incomplete" ||
      (identity.status === "unavailable" && guestFallbackAllowed),
  );
  const identityFormBlocked = $derived(
    identity.status === "loading" ||
      (identity.status === "unavailable" && !guestFallbackAllowed),
  );
  const lobbyNotice = $derived(resolveLobbyNotice());

  registerTopBar(() => {
    const liveGame =
      controller.started &&
      controller.mySlot !== null &&
      status.phase !== "gameOver";
    const gameVisible = controller.started && controller.mySlot !== null;
    const inRoom = controller.roomCode !== null;

    return {
      actions: !inRoom
        ? []
        : [
            ...(gameVisible
              ? [
                  {
                    id: "sound",
                    label: soundEnabled
                      ? gameCopy.controls.soundOff
                      : gameCopy.controls.soundOn,
                    shortLabel: gameCopy.controls.soundShort,
                    icon: soundEnabled ? Volume2 : VolumeX,
                    onSelect: toggleSound,
                    pressed: soundEnabled,
                  },
                ]
              : []),
            {
              id: "menu",
              label: topBarCopy.menuLabel,
              shortLabel: topBarCopy.menuShort,
              icon: Menu,
              panel: "menu" as const,
            },
          ],
      panels: inRoom
        ? [
            pagesGroup(),
            {
              id: "game",
              label: topBarCopy.groupGame,
              items: [
                ...(liveGame
                  ? [
                      {
                        id: "resign",
                        label: gameCopy.controls.resign,
                        icon: Flag,
                        onSelect: () => (pendingConfirm = "resign"),
                        danger: true,
                      },
                    ]
                  : []),
                {
                  id: "leave",
                  label: gameCopy.controls.leaveRoom,
                  icon: LogOut,
                  onSelect: () => (pendingConfirm = "leave"),
                },
              ],
            },
          ]
        : [],
      brandGuard:
        inRoom && status.phase !== "gameOver"
          ? () => (pendingConfirm = "home")
          : null,
    };
  });

  onMount(() => {
    guestId = getOrCreateGuestId();
    displayName = loadGuestDisplayName() ?? "";
    soundEnabled = loadSoundPreference();
    void soundPlayer.preload();
    pageOrigin = window.location.origin;

    const currentUrl = new URL(window.location.href);
    returnTo = `${currentUrl.pathname}${currentUrl.search}`;
    const linkedRoom = currentUrl.searchParams.get("room");
    if (linkedRoom !== null) {
      roomCodeInput = linkedRoom.trim().toUpperCase();
    }
    void refreshIdentity(true);

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
    if (!hasSeatIdentity()) {
      return;
    }

    if (turnstileRequired && !turnstileToken) {
      toast.show(copy.errors.turnstileFailed);
      return;
    }

    busy = true;
    toast.clear();
    if (!identityUsesAccount) saveGuestDisplayName(displayName);

    try {
      const identityTicket = identityUsesAccount
        ? await identity.requestTicket("create")
        : null;
      const seatName = identity.account?.username ?? displayName;
      const roomCode = await controller.createRoom(
        guestId,
        seatName,
        turnstileToken,
        identityTicket ?? undefined,
        identityUsesAccount ? requestIdentityTicket : undefined,
      );
      roomCodeInput = roomCode;
      replaceState(resolve(`/online?room=${roomCode}`), {});
    } catch (error) {
      toast.show(
        error instanceof OnlineCreateRoomError
          ? errorMessage(error.code)
          : error instanceof Error
            ? errorMessage(error.message)
            : copy.errors.createFailed,
      );
      resetTurnstile();
    } finally {
      busy = false;
    }
  }

  function joinRoom(): void {
    if (!hasSeatIdentity()) {
      return;
    }

    const roomCode = roomCodeInput.trim().toUpperCase();
    if (roomCode.length === 0) {
      toast.show(copy.errors.roomNotFound);
      return;
    }

    toast.clear();
    if (!identityUsesAccount) saveGuestDisplayName(displayName);
    controller.joinRoom(
      roomCode,
      guestId,
      identity.account?.username ?? displayName,
      identityUsesAccount ? requestIdentityTicket : undefined,
    );
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
    // Drop the finished room from the URL and from the sign-in return path so
    // the lobby cannot rejoin it.
    returnTo = "/online";
    replaceState(resolve("/online"), {});
  }

  function confirmPendingAction(): void {
    const action = pendingConfirm;
    pendingConfirm = null;

    if (action === "resign") {
      controller.resign();
    } else if (action === "leave") {
      leaveRoom();
    } else if (action === "home") {
      leaveRoom();
      void goto(resolve("/"));
    }
  }

  function toggleSound(): void {
    soundEnabled = !soundEnabled;
    saveSoundPreference(soundEnabled);

    if (soundEnabled) {
      void soundPlayer.unlock();
    }
  }

  function hasSeatIdentity(): boolean {
    if (identityFormBlocked || guestId.length === 0) return false;
    if (!identityUsesAccount && displayName.trim().length === 0) {
      toast.show(copy.errors.nameRequired);
      nameInput?.focus();
      return false;
    }

    return true;
  }

  async function refreshIdentity(autoJoin = false): Promise<void> {
    guestFallbackAllowed = false;
    await identity.refresh();
    if (
      autoJoin &&
      roomCodeInput.length > 0 &&
      (identity.status === "complete" ||
        ((identity.status === "signedOut" ||
          identity.status === "incomplete") &&
          displayName.trim().length > 0))
    ) {
      joinRoom();
    }
  }

  function requestIdentityTicket(
    action: "join" | "reconnect",
    roomCode: string,
  ): Promise<string | null> {
    return identity.requestTicket(action, roomCode);
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
      onNewMatch={leaveRoom}
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
              {#if identity.status === "signedOut"}
                <NoticeBanner tone="info">
                  {copy.identity.signIn}
                  <a
                    class="ml-1 font-semibold underline"
                    href={resolve(
                      `/login?returnTo=${encodeURIComponent(returnTo)}` as "/login",
                    )}>{copy.identity.signInAction}</a
                  >
                </NoticeBanner>
              {:else if identity.status === "incomplete"}
                <NoticeBanner tone="warning">
                  {copy.identity.incomplete}
                  <a
                    class="ml-1 font-semibold underline"
                    href={resolve(
                      `/register?returnTo=${encodeURIComponent(returnTo)}` as "/register",
                    )}>{copy.identity.completeRegistration}</a
                  >
                </NoticeBanner>
              {:else if identity.status === "unavailable" && !guestFallbackAllowed}
                <NoticeBanner tone="warning">
                  {copy.identity.unavailable}
                </NoticeBanner>
                <div class="flex flex-wrap gap-2">
                  <Button onclick={() => void refreshIdentity()}>
                    {copy.identity.retry}
                  </Button>
                  <Button
                    variant="outline"
                    onclick={() => (guestFallbackAllowed = true)}
                  >
                    {copy.identity.continueAsGuest}
                  </Button>
                </div>
              {/if}

              {#if identityUsesAccount && identity.account !== null}
                <div
                  class="flex items-center gap-3 rounded border border-board-700/20 bg-board-50 px-3 py-2"
                  data-testid="online-account-identity"
                >
                  <Avatar
                    username={identity.account.username}
                    initial={identity.account.avatar.initial}
                    color={identity.account.avatar.color}
                    avatarMode={identity.account.avatar.mode}
                    imageUrl={identity.account.avatar.imageUrl}
                    size="small"
                  />
                  <span class="min-w-0 truncate text-sm font-semibold">
                    {copy.identity.completePrefix}
                    @{identity.account.username}
                  </span>
                </div>
              {:else if guestFormAvailable || identity.status === "loading"}
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
              {/if}

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
                    disabled={busy ||
                      identityFormBlocked ||
                      guestId.length === 0}
                    onclick={joinRoom}
                    testId="join-room"
                  >
                    {busy ? copy.form.busy : copy.joinRoom}
                  </Button>
                {/if}
                <Button
                  variant={hasInviteCode ? "outline" : "primary"}
                  disabled={busy ||
                    identityFormBlocked ||
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
                    disabled={busy ||
                      identityFormBlocked ||
                      guestId.length === 0}
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
          playerIdentity={(player) => {
            const presence = controller.presence[player];
            return presence?.username && presence.avatar
              ? { username: presence.username, avatar: presence.avatar }
              : null;
          }}
        />
      </aside>
    </section>
  {/if}
</div>

<ConfirmDialog
  open={pendingConfirm !== null}
  title={pendingConfirm === "resign"
    ? gameCopy.controls.resign
    : pendingConfirm === "leave"
      ? gameCopy.controls.leaveRoom
      : gameCopy.controls.exitGame}
  body={pendingConfirm === "resign"
    ? gameCopy.prompts.resign
    : pendingConfirm === "home"
      ? gameCopy.prompts.home
      : gameCopy.prompts.leave}
  cancelLabel={gameCopy.tabletop.cancel}
  confirmLabel={gameCopy.tabletop.confirm}
  background={pageBackground}
  onClose={() => (pendingConfirm = null)}
  onConfirm={confirmPendingAction}
/>
