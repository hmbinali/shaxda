<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import {
    matchRatingViewSchema,
    type MatchRatingView,
    type MatchSave,
  } from "@shaxda/shared";
  import type { Snippet } from "svelte";

  let {
    rated,
    save,
    matchNumber,
    children,
  }: {
    rated: boolean;
    save?: MatchSave | null;
    matchNumber: number;
    children?: Snippet<[MatchRatingView | null]>;
  } = $props();

  const copy = siteContent.so.rating;
  const delays = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
  const seatIds = ["A", "B"] as const;

  let response = $state<{
    matchNumber: number;
    id: string;
    rating: MatchRatingView;
  }>();
  const view = $derived.by(() => {
    if (
      !rated ||
      save?.status !== "saved" ||
      response?.matchNumber !== matchNumber ||
      response.id !== save.matchId
    ) {
      return null;
    }
    return response.rating;
  });

  $effect(() => {
    const generation = matchNumber;
    if (!rated || save?.status !== "saved") return;
    const id = save.matchId;
    const abort = new AbortController();
    void poll();
    return () => abort.abort();

    async function poll() {
      const start = Date.now();
      for (const delay of delays) {
        await new Promise<void>((resolve) => {
          if (abort.signal.aborted) return resolve();
          const done = () => {
            clearTimeout(timer);
            abort.signal.removeEventListener("abort", done);
            resolve();
          };
          const timer = setTimeout(
            done,
            Math.max(0, start + delay - Date.now()),
          );
          abort.signal.addEventListener("abort", done, { once: true });
        });
        if (abort.signal.aborted) return;
        try {
          const result = await fetch(
            `/api/matches/${encodeURIComponent(id)}/rating`,
            { signal: abort.signal },
          );
          if (!result.ok) continue;
          const parsed = matchRatingViewSchema.safeParse(await result.json());
          if (abort.signal.aborted) return;
          if (parsed.success) {
            response = { matchNumber: generation, id, rating: parsed.data };
            if (parsed.data.status !== "pending") return;
          }
        } catch {
          if (abort.signal.aborted) return;
        }
      }
    }
  });

  function signed(value: number) {
    return value === 0 ? "0" : value > 0 ? `+${value}` : `−${Math.abs(value)}`;
  }
</script>

{#if rated}
  {@render children?.(view)}
  {#if save?.status === "pending" || (save?.status === "saved" && (!view || view.status === "pending"))}
    <p aria-live="polite" data-testid="match-rating-pending">{copy.pending}</p>
  {/if}
  {#if view?.status === "processed"}
    <div
      class="flex justify-center gap-4"
      aria-label={copy.label}
      data-testid="match-rating-confirmed"
    >
      {#each seatIds as seat (seat)}
        {@const rating = view.seats[seat]}
        {@const delta = signed(rating.delta)}
        <span
          >{seat} · {rating.after}{#if rating.provisional}<span
              title={copy.provisional}
              aria-label={copy.provisional}>?</span
            >{/if}
          <span aria-label={copy.change.replace("{delta}", delta)}>{delta}</span
          >
        </span>
      {/each}
    </div>
  {/if}
  {#if view?.updating}<p>{copy.updating}</p>{/if}
{/if}
