<script lang="ts">
  import { resolve } from "$app/paths";
  import { siteContent } from "@shaxda/i18n";
  import { gameFixtures } from "@shaxda/shared";
  import Board from "$components/Board.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import SiteShell from "$components/SiteShell.svelte";

  const page = siteContent.so.pages.home;
  const nav = siteContent.so.nav;
  const localPlayHref = "/local";
  const onlinePlayHref = "/online";
</script>

<PageMeta title={page.title} description={page.description} path={page.path} />

<SiteShell>
  <main>
    <section class="bg-board-100/35">
      <div
        class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_30rem] lg:items-center lg:px-8 lg:py-16"
      >
        <div>
          <p
            class="text-sm font-semibold uppercase tracking-normal text-red-800"
          >
            {page.heroEyebrow}
          </p>
          <h1 class="mt-3 text-5xl font-semibold tracking-normal sm:text-7xl">
            {page.heroTitle}
          </h1>
          <p class="mt-6 max-w-2xl text-lg leading-8 text-board-700">
            {page.heroBody}
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <a
              class="rounded bg-board-900 px-5 py-3 text-sm font-semibold text-board-50 hover:bg-board-700"
              href={localPlayHref}
              rel="external"
            >
              {page.primaryCta}
            </a>
            <a
              class="rounded border border-board-700/35 px-5 py-3 text-sm font-semibold text-board-900 hover:bg-board-50"
              href={onlinePlayHref}
              rel="external"
            >
              {page.secondaryCta}
            </a>
            <a
              class="rounded px-5 py-3 text-sm font-semibold text-board-700 hover:bg-board-50"
              href={resolve("/learn")}
            >
              {page.learnCta}
            </a>
          </div>
        </div>

        <div
          class="rounded border border-board-700/20 bg-board-50 p-4 shadow-sm"
        >
          <Board state={gameFixtures.movement} selected="O8" />
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid gap-4 md:grid-cols-3">
        {#each page.highlights as highlight (highlight)}
          <article class="rounded border border-board-700/20 bg-white/55 p-5">
            <p class="leading-7 text-board-700">{highlight}</p>
          </article>
        {/each}
      </div>
    </section>

    <section class="bg-white/45">
      <div class="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:px-8">
        {#each page.sections as section (section.title)}
          <article class="max-w-3xl">
            <h2 class="text-2xl font-semibold tracking-normal">
              {section.title}
            </h2>
            <p class="mt-3 leading-8 text-board-700">{section.body}</p>
          </article>
        {/each}

        <div class="mt-2 flex flex-wrap gap-3">
          <a
            class="rounded border border-board-700/35 px-4 py-2 text-sm font-semibold text-board-900 hover:bg-board-100/50"
            href={resolve("/learn")}
          >
            {nav.learn}
          </a>
          <a
            class="rounded border border-board-700/35 px-4 py-2 text-sm font-semibold text-board-900 hover:bg-board-100/50"
            href={resolve("/rules")}
          >
            {nav.rules}
          </a>
        </div>
      </div>
    </section>
  </main>
</SiteShell>
