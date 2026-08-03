<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { siteContent } from "@shaxda/i18n";
  import { appMetadata } from "@shaxda/shared";
  import ButtonLink from "$components/ui/ButtonLink.svelte";

  const copy = siteContent.so.errorPage;
  const errorCopy = $derived(
    page.status === 404 ? copy.notFound : copy.unexpected,
  );
</script>

<svelte:head>
  <title>{errorCopy.title} | {appMetadata.name}</title>
  <meta name="description" content={errorCopy.description} />
  <meta name="robots" content="noindex" />
</svelte:head>

<section
  class="mx-auto flex min-h-full max-w-3xl items-center px-4 py-16 sm:px-6"
>
  <div>
    <p class="text-sm font-bold uppercase tracking-wider text-red-800">
      {page.status}
    </p>
    <h1 class="mt-3 text-4xl font-semibold sm:text-6xl">
      {errorCopy.title}
    </h1>
    <p class="mt-5 max-w-2xl text-lg leading-8 text-board-700">
      {errorCopy.description}
    </p>
    <div class="mt-8 flex flex-wrap gap-3">
      <ButtonLink href={resolve("/")} variant="primary">
        {copy.homeCta}
      </ButtonLink>
      <ButtonLink href={resolve("/learn")}>
        {copy.learnCta}
      </ButtonLink>
    </div>
  </div>
</section>
