<script lang="ts">
  import { resolve } from "$app/paths";
  import { Menu } from "@lucide/svelte";
  import { messages, siteContent } from "@shaxda/i18n";
  import { getAppShell } from "$lib/shell/appShell.svelte";

  interface Props {
    menuButton?: HTMLButtonElement | null;
  }

  let { menuButton = $bindable(null) }: Props = $props();

  const shell = getAppShell();
  const sidebar = siteContent.so.sidebar;
</script>

<header
  data-testid="app-top-bar"
  class="flex h-14 shrink-0 items-center gap-1 border-b border-board-700/15 bg-board-50/95 px-3 backdrop-blur sm:h-16 sm:px-4"
>
  <button
    bind:this={menuButton}
    type="button"
    class="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-board-900 outline-none transition-colors hover:bg-board-100/65 focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 motion-reduce:transition-none"
    aria-label={sidebar.openMenu}
    aria-expanded={shell.drawerOpen}
    aria-controls="app-navigation-drawer"
    onclick={() => shell.toggle()}
  >
    <Menu size={22} aria-hidden="true" />
  </button>

  <a
    href={resolve("/")}
    class="rounded px-2 text-lg font-semibold tracking-normal outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2"
  >
    {messages.so.appName}
  </a>

  <div class="ml-auto flex items-center gap-1">
    {#each shell.actions as action (action.id)}
      <button
        type="button"
        class="action inline-flex size-11 shrink-0 items-center justify-center rounded-xl outline-none transition-colors hover:bg-board-100/65 focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 motion-reduce:transition-none"
        aria-label={action.label}
        title={action.label}
        aria-pressed={action.pressed === undefined ? undefined : action.pressed}
        data-pressed={action.pressed === undefined ? undefined : action.pressed}
        data-tone={action.tone ?? "default"}
        onclick={action.onSelect}
      >
        <action.icon size={21} aria-hidden="true" />
      </button>
    {/each}
  </div>
</header>

<style>
  .action {
    color: var(--color-board-900);
  }

  .action[data-pressed="true"] {
    background: color-mix(
      in srgb,
      var(--color-success, #176b55) 14%,
      transparent
    );
    color: var(--color-success, #176b55);
  }

  .action[data-tone="danger"] {
    color: var(--color-accent, #991b1b);
  }
</style>
