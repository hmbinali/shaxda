<script lang="ts">
  import { onMount } from "svelte";

  interface SectionLink {
    id: string;
    label: string;
  }

  interface Props {
    sections: readonly SectionLink[];
    label: string;
  }

  let { sections, label }: Props = $props();

  let observedSection = $state<string | null>(null);
  const activeSection = $derived(observedSection ?? sections[0]?.id ?? "");
  let mobileStrip = $state<HTMLElement | null>(null);

  onMount(() => {
    const root = document.getElementById("main-content");

    if (root === null || typeof IntersectionObserver === "undefined") {
      return;
    }

    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((target): target is HTMLElement => target !== null);
    const observer = new IntersectionObserver(
      () => {
        const rootTop = root.getBoundingClientRect().top;
        const current = targets
          .filter(
            (target) => target.getBoundingClientRect().bottom > rootTop + 72,
          )
          .sort(
            (left, right) =>
              Math.abs(left.getBoundingClientRect().top - rootTop - 72) -
              Math.abs(right.getBoundingClientRect().top - rootTop - 72),
          )[0];

        if (current !== undefined && current.id !== activeSection) {
          observedSection = current.id;
          keepMobileLinkVisible(current.id);
        }
      },
      {
        root,
        rootMargin: "-64px 0px -65% 0px",
        threshold: [0, 0.1, 0.5],
      },
    );

    for (const target of targets) {
      observer.observe(target);
    }

    return () => observer.disconnect();
  });

  function keepMobileLinkVisible(id: string): void {
    const strip = mobileStrip;
    const link = strip?.querySelector<HTMLElement>(`[href="#${id}"]`);

    if (strip === null || link === null || link === undefined) {
      return;
    }

    const left = link.offsetLeft - (strip.clientWidth - link.offsetWidth) / 2;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    strip.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });
  }
</script>

<div
  class="sticky top-0 z-30 -mx-4 border-y border-board-700/15 bg-board-50/95 px-4 py-2 backdrop-blur lg:static lg:z-auto lg:mx-0 lg:h-full lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
>
  <nav class="lg:hidden" aria-label={label}>
    <div
      bind:this={mobileStrip}
      class="flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-1"
    >
      {#each sections as section (section.id)}
        <a
          href={`#${section.id}`}
          aria-current={activeSection === section.id ? "location" : undefined}
          class="inline-flex min-h-11 shrink-0 snap-start items-center rounded-full border border-board-700/20 bg-white/80 px-4 text-sm font-semibold text-board-700 outline-none transition-colors hover:border-board-700/40 hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800 motion-reduce:transition-none"
          class:bg-board-900={activeSection === section.id}
          class:text-board-50={activeSection === section.id}
        >
          {section.label}
        </a>
      {/each}
    </div>
  </nav>

  <nav class="sticky top-6 hidden lg:block" aria-label={label}>
    <p class="px-3 text-xs font-bold uppercase tracking-wider text-red-800">
      {label}
    </p>
    <ol class="mt-3 grid gap-1">
      {#each sections as section, index (section.id)}
        <li>
          <a
            href={`#${section.id}`}
            aria-current={activeSection === section.id ? "location" : undefined}
            class="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-board-700 outline-none transition-colors hover:bg-board-100/65 hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800 motion-reduce:transition-none"
            class:bg-board-900={activeSection === section.id}
            class:text-board-50={activeSection === section.id}
          >
            <span aria-hidden="true">{index + 1}</span>
            <span>{section.label}</span>
          </a>
        </li>
      {/each}
    </ol>
  </nav>
</div>
