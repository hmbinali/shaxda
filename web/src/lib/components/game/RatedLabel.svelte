<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import { ratedLabel, type RatingDecision } from "$lib/rated-play/label";

  let {
    rated,
    decision,
    showDetail = true,
    corrected = false,
  }: {
    rated: boolean;
    decision?: RatingDecision | null;
    showDetail?: boolean;
    corrected?: boolean;
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
  {#if corrected && rated && !(decision?.status === "skipped" && decision.reason === "invalidated")}
    <span>{siteContent.so.rating.corrected}</span>
  {/if}
</div>
