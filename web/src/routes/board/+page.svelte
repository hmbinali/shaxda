<script lang="ts">
  import { messages } from "@shaxda/i18n";
  import { gameFixtures } from "@shaxda/shared";
  import type { GameState, PointId } from "@shaxda/game-engine";
  import Board from "$components/Board.svelte";

  type FixtureKey = keyof typeof gameFixtures;

  const copy = messages.so.boardGallery;
  const fixtureEntries = Object.entries(gameFixtures) as Array<
    [FixtureKey, GameState]
  >;
  const selectedPoints: Partial<Record<FixtureKey, PointId>> = {
    movement: "O8",
    repeatedJare: "O4",
  };
</script>

<svelte:head>
  <title>{copy.title} | {messages.so.appName}</title>
  <meta name="description" content={copy.intro} />
</svelte:head>

<section
  class="min-h-full bg-board-50 px-4 py-6 text-board-900 sm:px-6 lg:px-8"
>
  <section class="mx-auto max-w-7xl">
    <div
      class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="text-sm font-medium uppercase tracking-normal text-board-700">
          {messages.so.appName}
        </p>
        <h1 class="mt-1 text-3xl font-semibold tracking-normal sm:text-5xl">
          {copy.title}
        </h1>
      </div>
      <p class="max-w-xl text-base leading-7 text-board-700">{copy.intro}</p>
    </div>

    <div
      class="mb-6 flex flex-wrap gap-3 rounded border border-board-700/20 bg-white/40 p-3 text-sm text-board-700"
      aria-label="Astaamaha looxa"
    >
      <span class="inline-flex items-center gap-2">
        <span class="h-3 w-3 rounded-full border-2 border-sky-700"></span>
        {copy.selectedPoint}
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="h-3 w-3 rounded-full bg-success"></span>
        {copy.legalHint}
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="h-3 w-3 rounded-full border-2 border-dashed border-red-700"
        ></span>
        {copy.captureTarget}
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="h-3 w-3 rounded-full border-2 border-dotted border-warning"
        ></span>
        {copy.removalTarget}
      </span>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each fixtureEntries as [key, state] (key)}
        <article
          class="rounded border border-board-700/20 bg-white/55 p-4 shadow-sm"
        >
          <div class="mb-3 min-h-20">
            <h2 class="text-xl font-semibold tracking-normal">
              {copy.fixtureLabels[key]}
            </h2>
            <p class="mt-1 text-sm leading-6 text-board-700">
              {copy.fixtureDescriptions[key]}
            </p>
          </div>

          <Board {state} selected={selectedPoints[key] ?? null} />
        </article>
      {/each}
    </div>
  </section>
</section>
