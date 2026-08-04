<script lang="ts">
  import { siteContent, type LegalPageContent } from "@shaxda/i18n";
  import PageMeta from "$components/PageMeta.svelte";

  const page: LegalPageContent = siteContent.so.pages.legal;
</script>

<PageMeta title={page.title} description={page.description} path={page.path} />

<div data-testid="legal-page" class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
  <header class="border-b border-board-700/15 py-10 sm:py-12">
    <p class="text-sm font-bold uppercase tracking-wider text-red-800">
      {page.hero.eyebrow}
    </p>
    <h1 class="mt-3 text-3xl font-semibold sm:text-4xl">
      {page.hero.heading}
    </h1>
    <p class="mt-4 text-base leading-8 text-board-700">
      {page.hero.intro}
    </p>
    <p class="mt-4 text-sm text-board-700">
      {page.lastUpdatedLabel}: {page.lastUpdated}
    </p>
    <p class="mt-4 text-sm leading-7 text-board-700">
      {page.draftNotice}
    </p>
  </header>

  <article class="pb-12">
    {#each page.sections as section (section.id)}
      <section
        id={section.id}
        data-legal-section={section.id}
        class="doc-section border-b border-board-700/15 py-8 last:border-b-0 sm:py-10"
      >
        <h2 class="text-xl font-semibold text-board-900">
          {section.heading}
        </h2>

        {#if section.paragraphs.length > 0}
          <div class="mt-4 grid gap-4 text-base leading-8 text-board-700">
            {#each section.paragraphs as paragraph (paragraph)}
              <p>{paragraph}</p>
            {/each}
          </div>
        {/if}

        {#if section.bullets.length > 0}
          <ul class="mt-4 grid list-disc gap-2 pl-6 leading-8 text-board-700">
            {#each section.bullets as bullet (bullet)}
              <li>{bullet}</li>
            {/each}
          </ul>
        {/if}

        {#if section.details.length > 0}
          <dl class="mt-4 grid gap-3 leading-8 text-board-700">
            {#each section.details as item (item.term)}
              <div>
                <dt class="font-semibold text-board-900">{item.term}</dt>
                <dd>{item.detail}</dd>
              </div>
            {/each}
          </dl>
        {/if}

        {#if section.notes.length > 0}
          <div class="mt-4 grid gap-3 text-base leading-8 text-board-700">
            {#each section.notes as note (note)}
              <p>{note}</p>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </article>
</div>
