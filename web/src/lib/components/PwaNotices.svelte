<script lang="ts">
  import { Download, RefreshCw, WifiOff, X } from "@lucide/svelte";
  import { messages } from "@shaxda/i18n";
  import { getPwaController } from "$lib/pwa/pwa.svelte";

  const copy = messages.so.pwa;
  const pwa = getPwaController();
  const hasNotice = $derived(
    pwa !== null &&
      (!pwa.status.isOnline ||
        pwa.status.offlineReady ||
        pwa.status.needRefresh ||
        pwa.status.installable),
  );
</script>

{#if pwa !== null && hasNotice}
  <div
    class="grid gap-2 border-b border-board-700/15 bg-board-900 px-4 py-2 text-sm text-board-50 sm:px-6 lg:px-8"
    data-testid="pwa-notices"
  >
    {#if !pwa.status.isOnline}
      <div
        class="mx-auto flex w-full max-w-7xl items-start gap-3"
        role="status"
        data-testid="pwa-offline-notice"
      >
        <WifiOff class="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>
          <span class="font-semibold">{copy.offline.title}</span>
          <span class="ml-1 text-board-100">{copy.offline.body}</span>
        </p>
      </div>
    {/if}

    {#if pwa.status.offlineReady}
      <div
        class="mx-auto flex w-full max-w-7xl items-start gap-3"
        role="status"
        data-testid="pwa-offline-ready-notice"
      >
        <Download class="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>
          <span class="font-semibold">{copy.offlineReady.title}</span>
          <span class="ml-1 text-board-100">{copy.offlineReady.body}</span>
        </p>
      </div>
    {/if}

    {#if pwa.status.needRefresh}
      <div
        class="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        role="status"
        data-testid="pwa-update-notice"
      >
        <div class="flex items-start gap-3">
          <RefreshCw class="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          <p>
            <span class="font-semibold">{copy.update.title}</span>
            <span class="ml-1 text-board-100">{copy.update.body}</span>
          </p>
        </div>
        <button
          class="inline-flex w-fit items-center gap-2 rounded border border-board-50/25 px-3 py-1.5 font-semibold hover:bg-board-50/10"
          type="button"
          onclick={() => pwa.update()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.update.action}
        </button>
      </div>
    {/if}

    {#if pwa.status.installable}
      <div
        class="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        role="status"
        data-testid="pwa-install-notice"
      >
        <div class="flex items-start gap-3">
          <Download class="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          <p>
            <span class="font-semibold">{copy.install.title}</span>
            <span class="ml-1 text-board-100">{copy.install.body}</span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="inline-flex items-center gap-2 rounded bg-board-50 px-3 py-1.5 font-semibold text-board-900 hover:bg-board-100"
            type="button"
            onclick={() => pwa.promptInstall()}
          >
            <Download size={16} aria-hidden="true" />
            {copy.install.action}
          </button>
          <button
            class="inline-flex items-center gap-2 rounded border border-board-50/25 px-3 py-1.5 font-semibold hover:bg-board-50/10"
            type="button"
            onclick={() => pwa.dismissInstall()}
            aria-label={copy.install.dismiss}
          >
            <X size={16} aria-hidden="true" />
            {copy.install.dismiss}
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}
