<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import { gameFixtures } from "@shaxda/shared";
  import Board from "$components/Board.svelte";
  import PageMeta from "$components/PageMeta.svelte";

  const page = siteContent.so.pages.learn;
</script>

<PageMeta title={page.title} description={page.description} path={page.path} />

<div>
  <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-[1fr_28rem] lg:items-start">
      <div>
        <p class="text-sm font-semibold uppercase tracking-normal text-red-800">
          Shaxda
        </p>
        <h1 class="mt-3 text-4xl font-semibold tracking-normal sm:text-6xl">
          {page.heading}
        </h1>
        <p class="mt-5 max-w-3xl text-lg leading-8 text-board-700">
          {page.intro}
        </p>
      </div>

      <div class="rounded border border-board-700/20 bg-white/55 p-4">
        <Board state={gameFixtures.placementJare} />
      </div>
    </div>
  </section>

  <section class="bg-board-100/35">
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h2 class="text-2xl font-semibold tracking-normal">
        {page.quickStartTitle}
      </h2>
      <ol class="mt-5 grid gap-3 md:grid-cols-2">
        {#each page.quickStart as step, index (step)}
          <li class="rounded border border-board-700/20 bg-board-50 p-4">
            <span class="text-sm font-semibold text-red-800">
              {index + 1}
            </span>
            <p class="mt-2 leading-7 text-board-700">{step}</p>
          </li>
        {/each}
      </ol>
    </div>
  </section>

  <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <div class="grid gap-5 md:grid-cols-2">
      {#each page.topics as topic (topic.title)}
        <article class="rounded border border-board-700/20 bg-white/55 p-5">
          <h2 class="text-xl font-semibold tracking-normal">{topic.title}</h2>
          <p class="mt-3 leading-7 text-board-700">{topic.body}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="bg-white/45">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h2 class="text-2xl font-semibold tracking-normal">
        {page.mistakesTitle}
      </h2>
      <ul class="mt-5 grid gap-3 md:grid-cols-2">
        {#each page.mistakes as mistake (mistake)}
          <li
            class="rounded border border-red-900/20 bg-red-50/70 p-4 leading-7 text-board-700"
          >
            {mistake}
          </li>
        {/each}
      </ul>
    </div>
  </section>
</div>
