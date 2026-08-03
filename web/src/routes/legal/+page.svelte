<script lang="ts">
  import { siteContent, type LegalPageContent } from "@shaxda/i18n";
  import PageMeta from "$components/PageMeta.svelte";
  import Callout from "$lib/components/content/Callout.svelte";
  import SectionNav from "$lib/components/content/SectionNav.svelte";

  const page: LegalPageContent = siteContent.so.pages.legal;
  const sectionLinks = page.sections.map(({ id, navLabel }) => ({
    id,
    label: navLabel,
  }));
</script>

<PageMeta title={page.title} description={page.description} path={page.path} />

<div data-testid="legal-page">
  <header class="border-b border-board-700/15 bg-white/35">
    <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p class="text-sm font-bold uppercase tracking-wider text-red-800">
        {page.hero.eyebrow}
      </p>
      <h1 class="mt-3 text-4xl font-semibold tracking-normal sm:text-6xl">
        {page.hero.heading}
      </h1>
      <p class="mt-5 max-w-3xl text-lg leading-8 text-board-700">
        {page.hero.intro}
      </p>
      <p class="mt-4 text-sm text-board-700">
        {page.lastUpdatedLabel}: {page.lastUpdated}
      </p>
      <div class="mt-6 max-w-3xl">
        <Callout variant="digniin">
          <p>{page.draftNotice}</p>
        </Callout>
      </div>
    </div>
  </header>

  <div
    class="mx-auto grid min-w-0 max-w-[76rem] items-start gap-8 px-4 pb-10 sm:px-6 sm:pb-12 lg:grid-cols-[15rem_minmax(0,65ch)] lg:gap-12 lg:px-8 lg:pt-12"
  >
    <SectionNav sections={sectionLinks} label={page.navigationLabel} />

    <article class="min-w-0">
      {#each page.sections as section (section.id)}
        <section
          id={section.id}
          data-legal-section={section.id}
          class="doc-section border-b border-board-700/15 py-10 first:pt-10 last:border-b-0 last:pb-0 lg:py-14 lg:first:pt-0"
        >
          <h2 class="text-3xl font-semibold tracking-normal text-board-900">
            {section.heading}
          </h2>

          {#if section.paragraphs.length > 0}
            <div class="mt-5 grid gap-4 text-base leading-8 text-board-700">
              {#each section.paragraphs as paragraph (paragraph)}
                <p>{paragraph}</p>
              {/each}
            </div>
          {/if}

          {#if section.bullets.length > 0}
            <ul class="mt-5 grid list-disc gap-2 pl-6 leading-7 text-board-700">
              {#each section.bullets as bullet (bullet)}
                <li>{bullet}</li>
              {/each}
            </ul>
          {/if}

          {#if section.details.length > 0}
            <dl class="mt-6 grid gap-3 sm:grid-cols-2">
              {#each section.details as item (item.term)}
                <div
                  class="rounded-xl border border-board-700/20 bg-white/65 p-4"
                >
                  <dt class="font-bold text-board-900">{item.term}</dt>
                  <dd class="mt-1 text-sm leading-6 text-board-700">
                    {item.detail}
                  </dd>
                </div>
              {/each}
            </dl>
          {/if}

          {#if section.callouts.length > 0}
            <div class="mt-6 grid gap-3">
              {#each section.callouts as callout (callout.body)}
                <Callout variant={callout.variant}>
                  <p>{callout.body}</p>
                </Callout>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </article>
  </div>
</div>
