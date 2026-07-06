<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import { gameFixtures } from "@shaxda/shared";
  import Board from "$components/Board.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import SiteShell from "$components/SiteShell.svelte";

  const page = siteContent.so.pages.rules;
</script>

<PageMeta title={page.title} description={page.description} path={page.path} />

<SiteShell>
  <main>
    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid gap-10 lg:grid-cols-[1fr_28rem] lg:items-start">
        <div>
          <p
            class="text-sm font-semibold uppercase tracking-normal text-red-800"
          >
            Shaxda
          </p>
          <h1 class="mt-3 text-4xl font-semibold tracking-normal sm:text-6xl">
            {page.heading}
          </h1>
          <p class="mt-5 max-w-3xl text-lg leading-8 text-board-700">
            {page.intro}
          </p>
        </div>

        <div class="rounded border border-board-700/20 bg-board-100/45 p-4">
          <Board state={gameFixtures.repeatedJare} selected="O4" />
        </div>
      </div>
    </section>

    <section class="bg-white/45">
      <div class="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 lg:px-8">
        {#each page.sections as section (section.title)}
          <article class="rounded border border-board-700/20 bg-board-50 p-5">
            <h2 class="text-xl font-semibold tracking-normal">
              {section.title}
            </h2>
            <ul class="mt-4 grid gap-2">
              {#each section.items as item (item)}
                <li class="leading-7 text-board-700">{item}</li>
              {/each}
            </ul>
          </article>
        {/each}
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h2 class="text-2xl font-semibold tracking-normal">
        {page.jareLinesTitle}
      </h2>
      <ol class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {#each page.jareLines as line (line)}
          <li
            class="rounded border border-board-700/20 bg-white/55 px-4 py-3 font-mono text-sm text-board-700"
          >
            {line}
          </li>
        {/each}
      </ol>
    </section>
  </main>
</SiteShell>
