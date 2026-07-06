<script lang="ts">
  import { resolve } from "$app/paths";
  import { messages, siteContent } from "@shaxda/i18n";

  let { children }: { children: import("svelte").Snippet } = $props();

  const nav = siteContent.so.nav;
  const footer = siteContent.so.footer;
</script>

<div class="min-h-screen bg-board-50 text-board-900">
  <header class="border-b border-board-700/15 bg-board-50/95">
    <nav
      class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"
      aria-label="Hagaha bogga"
    >
      <a href={resolve("/")} class="text-2xl font-semibold tracking-normal">
        {messages.so.appName}
      </a>

      <div class="flex flex-wrap items-center gap-2 text-sm text-board-700">
        <a class="rounded px-3 py-2 hover:bg-board-100/65" href={resolve("/")}>
          {nav.home}
        </a>
        <a
          class="rounded px-3 py-2 hover:bg-board-100/65"
          href={resolve("/learn")}
        >
          {nav.learn}
        </a>
        <a
          class="rounded px-3 py-2 hover:bg-board-100/65"
          href={resolve("/rules")}
        >
          {nav.rules}
        </a>
        <a
          class="rounded px-3 py-2 hover:bg-board-100/65"
          href={resolve("/privacy")}
        >
          {nav.privacy}
        </a>
        <a
          class="rounded px-3 py-2 hover:bg-board-100/65"
          href={resolve("/terms")}
        >
          {nav.terms}
        </a>
      </div>
    </nav>
  </header>

  {@render children()}

  <footer class="border-t border-board-700/15 bg-board-100/35">
    <div
      class="mx-auto grid max-w-7xl gap-4 px-4 py-8 text-sm text-board-700 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8"
    >
      <p>{footer.tagline}</p>
      <div class="flex flex-wrap gap-3">
        <a class="hover:text-board-900" href={resolve("/privacy")}>
          {nav.privacy}
        </a>
        <a class="hover:text-board-900" href={resolve("/terms")}>
          {nav.terms}
        </a>
      </div>
      <p class="lg:col-span-2">{footer.reviewNote}</p>
    </div>
  </footer>
</div>
