<script lang="ts">
  import { base, resolve } from "$app/paths";
  import { siteContent, type LearnPageContent } from "@shaxda/i18n";
  import PageMeta from "$components/PageMeta.svelte";
  import Callout from "$lib/components/content/Callout.svelte";
  import SectionNav from "$lib/components/content/SectionNav.svelte";
  import DiagramSequence from "$lib/components/learn/DiagramSequence.svelte";

  const page: LearnPageContent = siteContent.so.pages.learn;
  const sectionLinks = page.sections.map(({ id, navLabel }) => ({
    id,
    label: navLabel,
  }));
  const ctaToneClasses = {
    emerald:
      "border-emerald-900/25 bg-emerald-700 text-white hover:bg-emerald-800",
    sky: "border-sky-900/25 bg-sky-700 text-white hover:bg-sky-800",
  } as const;
</script>

<PageMeta title={page.title} description={page.description} path={page.path} />

<div data-testid="learn-page">
  <header class="border-b border-board-700/15 bg-white/35">
    <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p class="text-sm font-bold uppercase tracking-wider text-red-800">
        {page.hero.eyebrow}
      </p>
      <h1 class="mt-3 text-4xl font-semibold sm:text-6xl">
        {page.hero.heading}
      </h1>
      <p class="mt-5 max-w-3xl text-lg leading-8 text-board-700">
        {page.hero.intro}
      </p>
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
          data-learn-section={section.id}
          class={`doc-section border-b border-board-700/15 py-10 first:pt-10 last:border-b-0 last:pb-0 lg:py-14 lg:first:pt-0 ${
            section.id === "talooyin"
              ? "rounded-2xl border border-amber-800/25 bg-amber-50/45 px-5 sm:px-7"
              : ""
          }`}
        >
          <h2 class="text-3xl font-semibold text-board-900">
            {section.heading}
          </h2>

          {#if section.paragraphs.length > 0}
            <div class="mt-5 grid gap-4 text-base leading-8 text-board-700">
              {#each section.paragraphs as paragraph (paragraph)}
                <p>{paragraph}</p>
              {/each}
            </div>
          {/if}

          {#if section.photo !== undefined}
            <figure
              class="mt-6 overflow-hidden rounded-2xl border border-board-700/20 bg-white/65 shadow-sm"
              data-testid="irmaan-photo"
            >
              <img
                src={`${base}${section.photo.src}`}
                alt={section.photo.alt}
                width={section.photo.width}
                height={section.photo.height}
                loading="lazy"
                decoding="async"
                class="h-auto w-full bg-board-100/30 object-cover"
              />
              <figcaption
                class="border-t border-board-700/15 px-4 py-3 text-sm leading-6 text-board-700"
              >
                {section.photo.caption}
              </figcaption>
            </figure>
          {/if}

          {#each section.subsections as subsection (subsection.heading)}
            <div class="mt-8">
              <h3 class="text-xl font-semibold text-board-900">
                {subsection.heading}
              </h3>
              {#if subsection.paragraphs.length > 0}
                <div class="mt-3 grid gap-4 leading-8 text-board-700">
                  {#each subsection.paragraphs as paragraph (paragraph)}
                    <p>{paragraph}</p>
                  {/each}
                </div>
              {/if}
              {#if subsection.rules.length > 0}
                <ul
                  class="mt-4 grid list-disc gap-2 pl-6 leading-7 text-board-700"
                >
                  {#each subsection.rules as rule (rule)}
                    <li>{rule}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/each}

          {#if section.rules.length > 0}
            <ul class="mt-5 grid list-disc gap-2 pl-6 leading-7 text-board-700">
              {#each section.rules as rule (rule)}
                <li>{rule}</li>
              {/each}
            </ul>
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

          {#each section.diagramGroups as group (group.label)}
            <DiagramSequence
              label={group.label}
              frames={group.frames}
              columns={group.columns}
            />
          {/each}

          {#if section.summary.length > 0}
            <dl class="mt-6 grid gap-3 sm:grid-cols-2">
              {#each section.summary as item (item.term)}
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

          {#if section.ctas.length > 0}
            <div
              class="mt-6 grid gap-3 sm:grid-cols-2"
              data-testid="learn-actions"
            >
              {#each section.ctas as cta (cta.href)}
                <a
                  href={resolve(cta.href)}
                  data-tone={cta.tone}
                  class={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2.5 text-center text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 motion-reduce:transition-none ${ctaToneClasses[cta.tone]}`}
                >
                  {cta.label}
                </a>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </article>
  </div>
</div>
