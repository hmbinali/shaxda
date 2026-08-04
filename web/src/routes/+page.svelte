<script lang="ts">
  import { resolve } from "$app/paths";
  import { siteContent } from "@shaxda/i18n";
  import PageMeta from "$components/PageMeta.svelte";
  import ButtonLink from "$components/ui/ButtonLink.svelte";

  const page = siteContent.so.pages.home;
</script>

<PageMeta title={page.title} description={page.description} path={page.path} />

<section class="grid min-h-full place-items-center px-4 py-12 sm:px-6 lg:px-8">
  <div class="w-full max-w-2xl text-center">
    <p class="text-sm font-semibold uppercase text-red-800">
      {page.heroEyebrow}
    </p>
    <h1 class="text-5xl font-semibold sm:text-7xl">
      {page.heroTitle}
    </h1>
    <p class="mx-auto mt-5 max-w-xl text-lg leading-8 text-board-700">
      {page.heroBody}
    </p>

    <div class="mx-auto mt-9 grid max-w-md gap-3 sm:grid-cols-2">
      <ButtonLink variant="primary" class="py-3.5" href={resolve("/local")}>
        {page.primaryCta}
      </ButtonLink>
      <ButtonLink class="py-3.5" href={resolve("/online")}>
        {page.secondaryCta}
      </ButtonLink>
    </div>
  </div>
</section>
