<script lang="ts">
  import { afterNavigate, beforeNavigate, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { messages } from "@shaxda/i18n";
  import type { PlayerId } from "@shaxda/game-engine";
  import { onMount, type Snippet } from "svelte";
  import Board from "$components/Board.svelte";
  import Button from "$components/ui/Button.svelte";
  import { getSoundPlayer } from "$lib/audio/sound";
  import {
    buildAnnouncement,
    buildStatusAnnouncement,
  } from "$lib/game/announce";
  import { buildGameStatus, classifyActionFeedback } from "$lib/game/status";
  import { interpolate } from "$lib/history/presentation";
  import type { MatchReplayData } from "$lib/replay/data";
  import {
    buildReplayFrames,
    type ReplayFacts,
    type ReplayFrame,
  } from "$lib/replay/frames";
  import { readReplayPosition, replayPositionUrl } from "$lib/replay/position";

  let {
    replay,
    matchId,
    facts,
    names,
    headline,
    reason,
    onlineEndReason,
    share,
  }: {
    replay: MatchReplayData;
    matchId: string;
    facts: ReplayFacts;
    names: Record<PlayerId, string>;
    headline: string;
    reason: string;
    onlineEndReason: "idle" | "abandoned" | null;
    share: Snippet<[number, boolean]>;
  } = $props();

  const copy = messages.so.matchReplay;
  const liveCopy = messages.so.localGame;
  const helpId = $props.id();

  let frames = $state.raw<readonly ReplayFrame[]>([]);
  let failed = $state(false);
  let position = $state(0);
  let isPlaying = $state(false);
  let speed = $state(1);
  let soundEnabled = $state(false);
  let announcement = $state("");
  let playbackTimer: ReturnType<typeof setTimeout> | undefined;
  let addressTimer: ReturnType<typeof setTimeout> | undefined;

  const frame = $derived(frames[position]);
  const total = $derived(frames.length - 1);
  const description = $derived(frame ? describe(frame) : "");
  const counter = $derived(
    interpolate(copy.counter, {
      position: String(position),
      total: String(total),
    }),
  );

  function describe({ state, cue }: ReplayFrame): string {
    const status = buildGameStatus(state);
    const playerName = (seat: PlayerId) => names[seat];
    if (cue === null) {
      return `${copy.startPosition} ${buildStatusAnnouncement(status, playerName)}`;
    }
    const action =
      cue.action.type === "resign" && onlineEndReason
        ? reason
        : buildAnnouncement(
            { action: cue.action, formedJare: cue.jareLines.length > 0 },
            status,
            playerName,
          );
    const advantage = cue.firstAdvantage
      ? interpolate(copy.firstAdvantage[cue.firstAdvantage.by], {
          name: names[cue.firstAdvantage.seat],
        })
      : "";
    const phase = cue.phaseEntered
      ? interpolate(copy.phaseEntered, {
          phase: liveCopy.phases[cue.phaseEntered],
        })
      : "";
    return [action, advantage, phase].filter(Boolean).join(" ");
  }

  function clearAddressWrite() {
    clearTimeout(addressTimer);
  }

  function writeAddress() {
    clearAddressWrite();
    const current = new URL(location.href);
    const canonical = replayPositionUrl(current, position);
    if (canonical.href !== current.href) {
      addressTimer = setTimeout(() => {
        // The current URL already includes the resolved base path.
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        replaceState(canonical, page.state);
      }, 300);
    }
  }

  function syncFromAddress() {
    if (!frames.length) return;
    pause();
    position = readReplayPosition(new URL(location.href), total);
    announcement = "";
    writeAddress();
  }

  function seek(next: number, manual: boolean, playSound = false) {
    const previous = frame;
    position = Math.min(total, Math.max(0, next));
    const current = frames[position];
    if (!current) return;

    if (
      soundEnabled &&
      playSound &&
      previous &&
      current !== previous &&
      current.cue
    ) {
      void getSoundPlayer().play(
        classifyActionFeedback(
          previous.state,
          current.cue.action,
          current.state,
        ),
      );
    }
    if (manual || position === total) {
      announcement = [
        interpolate(copy.counter, {
          position: String(position),
          total: String(total),
        }),
        describe(current),
        position === total ? headline : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    writeAddress();
  }

  function pause() {
    clearTimeout(playbackTimer);
    isPlaying = false;
  }

  function scheduleStep() {
    clearTimeout(playbackTimer);
    playbackTimer = setTimeout(() => {
      seek(position + 1, false, true);
      if (position === total) pause();
      else scheduleStep();
    }, 1000 / speed);
  }

  function togglePlayback() {
    if (isPlaying) {
      pause();
      return;
    }
    if (position === total) seek(0, false);
    announcement = "";
    isPlaying = true;
    scheduleStep();
  }

  function seekManually(next: number, playSound = false) {
    pause();
    seek(next, true, playSound);
  }

  function onKeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      !(event.key === "ArrowLeft" || event.key === "ArrowRight") ||
      (event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.matches("input, textarea, select")))
    )
      return;
    event.preventDefault();
    const forward = event.key === "ArrowRight";
    seekManually(position + (forward ? 1 : -1));
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    if (soundEnabled) void getSoundPlayer().unlock(null);
  }

  beforeNavigate(() => {
    pause();
    clearAddressWrite();
  });
  afterNavigate(syncFromAddress);

  onMount(() => {
    if (replay.kind !== "ready") return;
    const start = performance.now();
    const result = buildReplayFrames(replay, facts);
    performance.measure("shaxda:replay-build", { start });
    if (!result.ok) {
      console.warn("replayUnavailable", {
        matchId,
        rulesV: replay.rulesV,
        replayV: replay.replayV,
        ...result,
      });
      failed = true;
      return;
    }
    frames = result.frames;
    syncFromAddress();

    function onVisibilityChange() {
      if (document.hidden) pause();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      pause();
      clearAddressWrite();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions (Arrow keys are scoped to focused viewer controls.) -->
<section
  aria-label={copy.regionLabel}
  class="rounded-2xl border border-board-700/20 bg-board-50 p-4 sm:p-8"
  onkeydown={onKeydown}
>
  <h2 class="text-xl font-semibold">{copy.title}</h2>
  {#if replay.kind === "unavailable" || failed}
    <p class="mt-3 text-sm text-board-700">{copy.unavailable}</p>
  {:else if !frame}
    <div
      class="mx-auto my-4 grid aspect-square w-full max-w-[34rem] place-items-center rounded-xl bg-board-100 p-4 text-center text-board-700"
    >
      {copy.loading}
    </div>
  {:else}
    <div class="mx-auto mt-4 w-full max-w-[34rem]" data-testid="replay-viewer">
      <p class="mb-2 truncate font-semibold" data-testid="replay-seat-A">
        A · {names.A}
      </p>
      <div class="relative">
        <Board state={frame.state} mode="replay" cue={frame.cue} />
        {#if position === total}
          <div
            class="pointer-events-none absolute inset-0 grid place-items-center p-3"
          >
            <div
              class="max-w-full rounded-xl border border-board-700/20 bg-board-50/95 p-4 text-center shadow-md"
              data-testid="replay-result"
            >
              <p class="font-bold">{headline}</p>
              <p class="mt-1 text-sm text-board-700">{reason}</p>
            </div>
          </div>
        {/if}
      </div>
      <p class="mt-2 truncate font-semibold" data-testid="replay-seat-B">
        B · {names.B}
      </p>
      <p
        class="mt-3 min-h-12 text-sm text-board-700"
        data-testid="replay-description"
      >
        {description}
      </p>
      <p class="mt-2 font-semibold tabular-nums">
        <span class="sr-only">{counter}</span>
        <span data-testid="replay-counter" aria-hidden="true"
          >{position} / {total}</span
        >
      </p>
      <p class="sr-only" id={helpId}>{copy.keyboardHelp}</p>
      <div
        role="group"
        aria-label={copy.regionLabel}
        aria-describedby={helpId}
        class="mt-3 flex flex-wrap gap-2"
      >
        <Button
          variant="outline"
          disabled={position === 0}
          onclick={() => seekManually(0)}>{copy.controls.start}</Button
        >
        <Button
          variant="outline"
          disabled={position === 0}
          onclick={() => seekManually(position - 1)}
          >{copy.controls.previous}</Button
        >
        <Button onclick={togglePlayback}
          >{isPlaying ? copy.controls.pause : copy.controls.play}</Button
        >
        <Button
          variant="outline"
          disabled={position === total}
          onclick={() => seekManually(position + 1, true)}
          >{copy.controls.next}</Button
        >
        <Button
          variant="outline"
          disabled={position === total}
          onclick={() => seekManually(total)}>{copy.controls.end}</Button
        >
        <label
          class="inline-flex min-h-10 items-center gap-2 rounded-md border border-board-700/20 px-2 text-sm font-medium"
        >
          {copy.controls.speed}
          <select
            class="min-h-9 rounded bg-board-50"
            value={speed}
            onchange={(event) => {
              speed = Number(event.currentTarget.value);
              if (isPlaying) scheduleStep();
            }}
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
        <Button
          variant="outline"
          ariaPressed={soundEnabled}
          onclick={toggleSound}
        >
          {soundEnabled
            ? liveCopy.controls.soundOff
            : liveCopy.controls.soundOn}
        </Button>
      </div>
      <p role="status" class="sr-only">{announcement}</p>
    </div>
  {/if}
</section>
{@render share(position, !!frame)}
