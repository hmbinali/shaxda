<script lang="ts">
  import type { PlayerId } from "@shaxda/game-engine";
  import type { Snippet } from "svelte";
  import type { GameStatus } from "$lib/game/status";
  import GameStatusPanel from "./GameStatusPanel.svelte";

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
    actions?: Snippet;
  }

  let {
    status,
    playerName,
    leadingFields = [],
    showFirstAdvantage = true,
    showTurnsSinceCapture = true,
    actions,
  }: Props = $props();
</script>

<div class="panel" data-testid="game-details-panel">
  <GameStatusPanel
    {status}
    {playerName}
    {leadingFields}
    {showFirstAdvantage}
    {showTurnsSinceCapture}
  />
  {#if actions}
    <div class="actions">
      {@render actions()}
    </div>
  {/if}
</div>

<style>
  .panel {
    display: grid;
    gap: 0.75rem;
  }

  .actions {
    display: grid;
    gap: 0.5rem;
    border: 1px solid rgb(106 61 37 / 0.2);
    border-radius: 0.25rem;
    background: rgb(255 255 255 / 0.6);
    padding: 1rem;
  }
</style>
