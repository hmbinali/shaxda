<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import PageMeta from "$components/PageMeta.svelte";

  const page = siteContent.so.pages.privacy;
</script>

<PageMeta title={page.title} description={page.description} path={page.path} />

<section class="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
  <h1 class="text-4xl font-semibold tracking-normal sm:text-6xl">
    {page.heading}
  </h1>
  <p class="mt-5 text-lg leading-8 text-board-700">{page.intro}</p>

  <div class="mt-10 grid gap-5">
    {#each page.sections as section (section.title)}
      <article class="rounded border border-board-700/20 bg-white/55 p-5">
        <h2 class="text-xl font-semibold tracking-normal">{section.title}</h2>
        <p class="mt-3 leading-7 text-board-700">{section.body}</p>
      </article>
    {/each}
  </div>
</section>
