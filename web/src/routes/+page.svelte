<script lang="ts">
  import { resolve } from "$app/paths";
  import { siteContent } from "@shaxda/i18n";
  import PageMeta from "$components/PageMeta.svelte";

  const page = siteContent.so.pages.home;
  const nav = siteContent.so.nav;
</script>

<PageMeta title={page.title} description={page.description} path={page.path} />

<section class="grid min-h-full place-items-center px-4 py-12 sm:px-6 lg:px-8">
  <div class="w-full max-w-2xl text-center">
    <h1 class="text-5xl font-semibold tracking-normal sm:text-7xl">
      {page.heroTitle}
    </h1>
    <p class="mx-auto mt-5 max-w-xl text-lg leading-8 text-board-700">
      {page.heroBody}
    </p>

    <div class="mx-auto mt-9 grid max-w-md gap-3 sm:grid-cols-2">
      <a
        class="rounded-lg bg-board-900 px-5 py-3.5 text-sm font-semibold text-board-50 outline-none hover:bg-board-700 focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2"
        href={resolve("/local")}
      >
        {nav.localPlay}
      </a>
      <a
        class="rounded-lg border border-board-700/35 bg-white/45 px-5 py-3.5 text-sm font-semibold text-board-900 outline-none hover:bg-board-100/50 focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2"
        href={resolve("/online")}
      >
        {nav.onlinePlay}
      </a>
    </div>
  </div>
</section>
