<script lang="ts">
  import type { PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import { modal } from "$lib/a11y/modal";
  import type { GameStatus } from "$lib/game/status";
  import Button from "$components/ui/Button.svelte";
  import type { GameResultAction } from "./gameResultActions";

  interface Props {
    status: GameStatus;
    playerName: (player: PlayerId) => string;
    reason?: string | null;
    notice?: string | null;
    testId: string;
    actions: readonly GameResultAction[];
    inertTargets?: readonly (HTMLElement | null | undefined)[];
  }

  let {
    status,
    playerName,
    reason = null,
    notice = null,
    testId,
    actions,
    inertTargets = [],
  }: Props = $props();

  const copy = messages.so.localGame;
  const titleId = $derived(`${testId}-title`);
  const reasonId = $derived(`${testId}-reason`);
  const noticeId = $derived(`${testId}-notice`);
  const describedBy = $derived(
    [reason === null ? null : reasonId, notice === null ? null : noticeId]
      .filter((id) => id !== null)
      .join(" "),
  );
  let primaryAction = $state<HTMLButtonElement | null>(null);
</script>

<div
  class="overlay"
  data-testid={testId}
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby={titleId}
  aria-describedby={describedBy.length === 0 ? undefined : describedBy}
  use:modal={{ inertTargets, initialFocus: primaryAction, onEscape: null }}
>
  <div class="result-panel" data-testid="game-result-panel">
    <div
      class="piece-token"
      class:light={status.winner === "A"}
      class:dark={status.winner === "B"}
      class:draw={status.winner === null}
      aria-hidden="true"
    >
      {status.winner ?? "—"}
    </div>

    {#if status.winner === null}
      <h2 id={titleId}>{copy.result.drawLabel}</h2>
    {:else}
      <h2 id={titleId}>
        {copy.result.winnerLabel}: {playerName(status.winner)}
      </h2>
    {/if}

    {#if reason !== null}
      <p id={reasonId}>{reason}</p>
    {/if}

    {#if notice !== null}
      <p id={noticeId} class="notice" data-testid="{testId}-notice">
        {notice}
      </p>
    {/if}

    <div
      class="actions"
      class:single={actions.length === 1}
      class:lead={actions.length % 2 === 1 && actions.length > 1}
    >
      {#each actions as action, index (action.id)}
        {#if index === 0}
          <Button
            bind:element={primaryAction}
            variant={action.variant ?? "primary"}
            onclick={action.onSelect}
            testId={action.testId}
            data-result-primary
          >
            {action.label}
          </Button>
        {:else}
          <Button
            variant={action.variant ?? "outline"}
            onclick={action.onSelect}
            testId={action.testId}
          >
            {action.label}
          </Button>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: absolute;
    z-index: 25;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(46 32 25 / 0.38);
    backdrop-filter: blur(1px);
    padding: 1rem;
  }

  .result-panel {
    display: grid;
    width: min(100%, 20rem);
    justify-items: center;
    gap: 0.75rem;
    border: 1px solid rgb(234 216 194 / 0.28);
    border-radius: 1rem;
    background: rgb(51 32 22 / 0.96);
    padding: 1.15rem;
    color: var(--color-board-50);
    box-shadow: 0 1rem 2.5rem rgb(33 18 9 / 0.28);
    text-align: center;
    animation: result-enter 180ms ease-out both;
  }

  .piece-token {
    display: grid;
    width: 3.25rem;
    height: 3.25rem;
    place-items: center;
    border: 2px solid rgb(248 241 232 / 0.35);
    border-radius: 999px;
    box-shadow: 0 0.35rem 0.8rem rgb(0 0 0 / 0.24);
    font-size: 0.8rem;
    font-weight: 900;
  }

  .piece-token.light {
    background: radial-gradient(
      circle at 33% 28%,
      #fffaf1,
      #f3dfbf 68%,
      #a8886d
    );
    color: #604b3c;
  }

  .piece-token.dark {
    background: radial-gradient(
      circle at 33% 28%,
      #9f6d4d,
      #5b3020 66%,
      #25120d
    );
    color: #fff4e5;
  }

  .piece-token.draw {
    background: linear-gradient(135deg, #f3dfbf 0 50%, #5b3020 50% 100%);
    color: transparent;
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: 1.15rem;
    font-weight: 800;
  }

  p {
    color: var(--color-board-100);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    width: 100%;
  }

  .actions.single {
    grid-template-columns: 1fr;
  }

  /* An odd action count keeps the primary action on its own full-width row. */
  .actions.lead > :global(:first-child) {
    grid-column: 1 / -1;
  }

  .notice {
    font-weight: 600;
  }

  @keyframes result-enter {
    from {
      opacity: 0;
      transform: translateY(0.4rem) scale(0.98);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .result-panel {
      animation: none;
    }
  }
</style>
