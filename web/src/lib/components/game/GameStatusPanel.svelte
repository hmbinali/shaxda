<script lang="ts">
  import type { PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import type { GameStatus } from "$lib/game/status";

  interface StatusField {
    label: string;
    value: string;
    monospaced?: boolean;
  }

  interface Props {
    status: GameStatus;
    playerName: (player: PlayerId) => string;
    leadingFields?: readonly StatusField[];
    showFirstAdvantage?: boolean;
    showTurnsSinceCapture?: boolean;
    blockedPrompt?: string | null;
  }

  let {
    status,
    playerName,
    leadingFields = [],
    showFirstAdvantage = true,
    showTurnsSinceCapture = true,
    blockedPrompt = null,
  }: Props = $props();

  const copy = messages.so.localGame;
</script>

<section class="rounded border border-board-700/20 bg-white/60 p-4">
  <dl class="grid gap-3 text-sm">
    {#each leadingFields as field (`${field.label}-${field.value}`)}
      <div>
        <dt class="font-semibold text-board-900">{field.label}</dt>
        <dd class="mt-1 text-board-700" class:font-mono={field.monospaced}>
          {field.value}
        </dd>
      </div>
    {/each}
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
    {#if showFirstAdvantage && status.firstAdvantage !== null}
      <div>
        <dt class="font-semibold text-board-900">
          {copy.firstAdvantageLabel}
        </dt>
        <dd class="mt-1 text-board-700">
          {playerName(status.firstAdvantage)}
        </dd>
      </div>
    {/if}
    {#if showTurnsSinceCapture}
      <div>
        <dt class="font-semibold text-board-900">
          {copy.turnsSinceCaptureLabel}
        </dt>
        <dd class="mt-1 text-board-700">{status.turnsSinceCapture}</dd>
      </div>
    {/if}
  </dl>

  {#if status.isSpaceMaking && blockedPrompt !== null}
    <p
      class="mt-4 rounded border border-amber-700/25 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900"
      data-testid="blocked-prompt"
    >
      {blockedPrompt}
    </p>
  {/if}
</section>
