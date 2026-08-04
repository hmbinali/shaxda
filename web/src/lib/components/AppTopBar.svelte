<script lang="ts">
  import { resolve } from "$app/paths";
  import { messages, siteContent } from "@shaxda/i18n";
  import { untrack } from "svelte";
  import AppNavPanel from "$lib/components/AppNavPanel.svelte";
  import BrandMark from "$lib/components/BrandMark.svelte";
  import { getAppShell } from "$lib/shell/appShell.svelte";
  import { defaultTopBar } from "$lib/shell/topBarConfig";

  interface Props {
    pathname: string;
  }

  let { pathname }: Props = $props();

  const shell = getAppShell();
  const topBar = siteContent.so.topBar;
  const config = $derived(shell.config ?? defaultTopBar(pathname));
  let previousPathname = untrack(() => pathname);

  $effect(() => {
    if (pathname === previousPathname) {
      return;
    }

    previousPathname = pathname;
    shell.closePanel();
  });
</script>

<header
  data-testid="app-top-bar"
  class="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-board-700/15 bg-board-50/95 px-3 backdrop-blur sm:h-16 sm:px-4"
>
  {#if config.brandGuard === null}
    <a
      href={resolve("/")}
      aria-label={topBar.brandLabel}
      class="inline-flex min-w-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
    >
      <BrandMark />
      <span class="truncate text-lg font-semibold">{messages.so.appName}</span>
    </a>
  {:else}
    <button
      type="button"
      aria-label={topBar.brandLabel}
      class="inline-flex min-w-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      onclick={config.brandGuard}
    >
      <BrandMark />
      <span class="truncate text-lg font-semibold">{messages.so.appName}</span>
    </button>
  {/if}

  <nav class="ml-auto flex items-center gap-1" aria-label={topBar.actionsLabel}>
    {#each config.actions as action (action.id)}
      <button
        type="button"
        class="action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-2.5 outline-none transition-colors hover:bg-board-100/65 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none md:px-3"
        aria-label={action.label}
        title={action.label}
        aria-pressed={action.pressed === undefined ? undefined : action.pressed}
        aria-expanded={action.panel === undefined
          ? undefined
          : shell.panel === action.panel}
        aria-controls={action.panel === undefined ? undefined : "app-nav-panel"}
        data-nav-panel-trigger={action.panel ?? undefined}
        data-pressed={action.pressed === undefined ? undefined : action.pressed}
        data-tone={action.tone ?? "default"}
        disabled={action.disabled}
        onclick={() =>
          action.panel === undefined
            ? action.onSelect?.()
            : shell.togglePanel(action.panel)}
      >
        <action.icon size={21} aria-hidden="true" />
        <span class="hidden text-sm font-semibold md:inline">
          {action.shortLabel}
        </span>
      </button>
    {/each}
  </nav>

  {#if shell.panel !== null}
    <AppNavPanel groups={config.panels} />
  {/if}
</header>

<style>
  .action {
    color: var(--color-board-900);
  }

  .action[data-pressed="true"] {
    background: color-mix(in srgb, var(--color-success) 14%, transparent);
    color: var(--color-board-900);
  }

  .action[data-tone="danger"] {
    color: var(--color-accent);
  }
</style>
