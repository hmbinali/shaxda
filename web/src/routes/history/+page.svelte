<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import MatchParticipant from "$components/history/MatchParticipant.svelte";
  import RatedLabel from "$components/game/RatedLabel.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import ButtonLink from "$components/ui/ButtonLink.svelte";
  import {
    computeStreak,
    formatDuration,
    formatMatchDate,
    recentForm,
  } from "$lib/history/format";
  import { interpolate } from "$lib/history/presentation";
  import { matchPath } from "$lib/site/metadata";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const copy = siteContent.so.pages.history;
  const percent = new Intl.NumberFormat("so-SO", {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const streak = $derived(computeStreak(data.summary?.recent ?? []));
</script>

<PageMeta
  title={copy.title}
  description={copy.description}
  path={copy.path}
  noindex
/>

<section
  class="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-10 sm:px-6 sm:py-14"
>
  <header>
    <p class="text-xs font-bold uppercase tracking-wider text-board-700">
      {copy.eyebrow}
    </p>
    <h1 class="mt-2 text-4xl font-semibold sm:text-5xl">{copy.title}</h1>
    <p class="mt-3 text-board-700">{copy.description}</p>
  </header>

  {#if data.summary && data.summary.games > 0}
    {@const summary = data.summary}
    <section
      class="rounded-2xl border border-board-700/20 bg-board-50 p-5 sm:p-6"
      aria-labelledby="history-summary"
    >
      <h2 id="history-summary" class="font-bold">{copy.summary.caption}</h2>
      <dl class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div>
          <dt>{copy.summary.games}</dt>
          <dd class="text-2xl font-bold">{summary.games}</dd>
        </div>
        <div>
          <dt>{copy.row.outcome.win}</dt>
          <dd class="text-2xl font-bold">{summary.wins}</dd>
        </div>
        <div>
          <dt>{copy.row.outcome.loss}</dt>
          <dd class="text-2xl font-bold">{summary.losses}</dd>
        </div>
        <div>
          <dt>{copy.row.outcome.draw}</dt>
          <dd class="text-2xl font-bold">{summary.draws}</dd>
        </div>
        <div>
          <dt>{copy.summary.winRate}</dt>
          <dd class="text-2xl font-bold">
            {percent.format(summary.wins / summary.games)}
          </dd>
        </div>
        {#if streak}
          {@const n = streak.capped
            ? interpolate(copy.streak.capped, { n: String(streak.length) })
            : String(streak.length)}
          <div class="col-span-2">
            <dt>{copy.summary.streak}</dt>
            <dd class="font-semibold">
              {interpolate(copy.streak[streak.result], { n })}
            </dd>
          </div>
        {/if}
        <div class="col-span-full">
          <dt>{copy.summary.form}</dt>
          <dd>
            <ol class="mt-2 flex flex-wrap gap-1.5" role="list">
              {#each recentForm(summary.recent) as item (item)}
                <li
                  aria-label={item.label}
                  class="grid size-7 place-items-center rounded bg-board-200 text-xs font-bold text-board-900"
                >
                  <span aria-hidden="true">{item.mark}</span>
                </li>
              {/each}
            </ol>
          </dd>
        </div>
      </dl>
    </section>
  {/if}

  <nav class="flex flex-wrap gap-2" aria-label={copy.filters.label}>
    {#each data.filters as option (option.value)}
      <ButtonLink
        href={option.href}
        size="compact"
        variant={option.value === data.filter ? "primary" : "outline"}
        aria-current={option.value === data.filter ? "page" : undefined}
        >{copy.filters[option.value]}</ButtonLink
      >
    {/each}
  </nav>

  {#if data.rows.length > 0}
    <div class="flex flex-col gap-3 md:gap-1.5">
      {#each data.rows as row (row.id)}
        <article
          data-testid="history-row"
          class="grid grid-cols-2 items-center gap-x-4 gap-y-3 rounded-xl border border-board-700/20 bg-board-50 px-4 py-4 text-sm md:grid-cols-[minmax(9rem,1.5fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(5rem,0.75fr)_auto]"
        >
          <div class="col-span-2 min-w-0 md:col-span-1">
            <span class="sr-only">{copy.row.opponent}</span>
            <MatchParticipant participant={row.opponent} />
          </div>
          <div>
            <span class="sr-only">{copy.row.result}</span>
            <p class="font-bold">{copy.row.outcome[row.result]}</p>
            <p class="text-board-700">
              {copy.endReasons[row.onlineEndReason ?? row.endReason]}
            </p>
          </div>
          <div>
            {#if row.mode === "quick"}
              <p class="mb-1 text-xs">{copy.row.quick}</p>
            {/if}
            <RatedLabel
              rated={row.rated}
              decision={row.ratingDecision}
              corrected={row.ratingCorrected}
              showDetail={row.rated}
            />
          </div>
          <div class="text-board-700">
            <span class="sr-only">{copy.row.playedAt}</span>
            <time datetime={new Date(row.endedAt).toISOString()}
              >{formatMatchDate(row.endedAt)}</time
            >
            <p>
              <span class="sr-only">{copy.row.duration}</span>{formatDuration(
                row.endedAt - row.startedAt,
              )}
            </p>
          </div>
          <div>
            <span class="text-xs text-board-700">{copy.row.pieces}</span>
            <p class="text-base font-semibold tabular-nums">
              {row.piecesLeft} – {row.opponentPiecesLeft}
            </p>
          </div>
          <ButtonLink
            href={matchPath(row.id)}
            size="compact"
            class="justify-self-start">{copy.row.view}</ButtonLink
          >
        </article>
      {/each}
    </div>
  {:else}
    <div class="rounded-2xl border border-board-700/20 bg-board-50 p-6">
      {#if data.summary?.games === 0}
        <h2 class="text-xl font-semibold">{copy.empty.title}</h2>
        <p class="mt-2 text-board-700">{copy.empty.body}</p>
        <ButtonLink href="/online" class="mt-4" variant="primary"
          >{siteContent.so.nav.onlinePlay}</ButtonLink
        >
      {:else}
        <p>{copy.emptyFiltered}</p>
        {#if data.firstHref}
          <ButtonLink href={data.firstHref} class="mt-4"
            >{copy.first}</ButtonLink
          >
        {/if}
      {/if}
    </div>
  {/if}
  {#if data.nextHref}
    <ButtonLink href={data.nextHref} rel="next" class="self-start"
      >{copy.older}</ButtonLink
    >
  {/if}
</section>
