<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import {
    playerRatingViewSchema,
    type PlayerRatingView,
  } from "@shaxda/shared";

  let { username }: { username: string } = $props();
  const copy = siteContent.so.rating;
  let response = $state<{ username: string; rating: PlayerRatingView }>();
  const rating = $derived(
    response?.username === username ? response.rating : null,
  );

  $effect(() => {
    const name = username;
    const abort = new AbortController();
    void fetch(`/api/players/${encodeURIComponent(name)}/rating`, {
      signal: abort.signal,
    })
      .then(async (result) => {
        if (!result.ok) return;
        const parsed = playerRatingViewSchema.safeParse(await result.json());
        if (!abort.signal.aborted && parsed.success)
          response = { username: name, rating: parsed.data };
      })
      .catch(() => undefined);
    return () => abort.abort();
  });
</script>

{#if rating}
  <span class="text-xs" data-testid="player-rating">
    {#if rating.rated}
      {rating.rating}{#if rating.provisional}<span
          title={copy.provisional}
          aria-label={copy.provisional}>?</span
        >{/if}
    {:else}
      {copy.unrated}
    {/if}
  </span>
{/if}
