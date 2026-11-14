<script lang="ts">
  import { ratedLabel, type RatingDecision } from "$lib/rated-play/label";

  let {
    rated,
    decision,
    showDetail = true,
  }: {
    rated: boolean;
    decision?: RatingDecision | null;
    showDetail?: boolean;
  } = $props();
  const label = $derived(ratedLabel(rated, decision));
</script>

<div class="grid gap-1 text-xs leading-snug" data-testid="rated-label">
  <strong
    >{label.mode}{#if label.status}
      · {label.status}{/if}</strong
  >
  {#if showDetail && label.detail}
    <span>{label.detail}</span>
  {/if}
</div>
