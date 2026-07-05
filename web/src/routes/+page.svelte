<script lang="ts">
  import { appMetadata } from "@shaxda/shared";
  import { messages } from "@shaxda/i18n";
</script>

<svelte:head>
  <title>{appMetadata.name}</title>
  <meta name="description" content={appMetadata.description} />
</svelte:head>

<main class="min-h-screen bg-board-50 px-5 py-8 text-board-900">
  <section
    class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-between gap-10"
  >
    <div class="flex items-center justify-between gap-4">
      <strong class="text-xl tracking-normal">{messages.so.appName}</strong>
      <span
        class="rounded border border-board-700/25 px-2 py-1 text-sm text-board-700"
        >F1</span
      >
    </div>

    <div class="max-w-2xl">
      <p
        class="mb-3 text-sm font-medium uppercase tracking-normal text-board-700"
      >
        {messages.so.foundationLabel}
      </p>
      <h1 class="text-4xl font-semibold tracking-normal sm:text-6xl">
        {messages.so.appName}
      </h1>
      <p class="mt-5 max-w-xl text-lg leading-8 text-board-700">
        {messages.so.foundationSummary}
      </p>
    </div>
    <p class="text-sm text-board-700">Soomaali keliya - ciyaar marti ah</p>
  </section>
</main>
