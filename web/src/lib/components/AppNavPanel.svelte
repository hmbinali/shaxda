<script lang="ts">
  import { resolve } from "$app/paths";
  import { siteContent } from "@shaxda/i18n";
  import { onMount } from "svelte";
  import { modal } from "$lib/a11y/modal";
  import { getAppShell, type NavPanelGroup } from "$lib/shell/appShell.svelte";

  interface Props {
    kind: "menu" | "account";
    groups: NavPanelGroup[];
  }

  let { kind, groups }: Props = $props();

  const shell = getAppShell();
  const topBar = siteContent.so.topBar;
  const panelLabel = $derived(
    kind === "account" ? topBar.accountPanelLabel : topBar.menuPanelLabel,
  );

  onMount(() => {
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest("#app-nav-panel") !== null ||
        target.closest("[data-nav-panel-trigger]") !== null
      ) {
        return;
      }

      shell.closePanel();
    };

    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  });

  function select(action: () => void): void {
    shell.closePanel();
    action();
  }
</script>

<div
  id="app-nav-panel"
  role="menu"
  aria-label={panelLabel}
  tabindex="-1"
  class="nav-panel absolute right-2 top-full z-40 w-[min(17.5rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-board-700/30 bg-board-50 shadow-2xl outline-none md:right-4"
  use:modal={{ onEscape: () => shell.closePanel() }}
>
  {#each groups as group, index (group.id)}
    {#if index > 0}<hr class="border-board-700/15" />{/if}
    <section
      class="p-2"
      role="group"
      aria-labelledby={`app-nav-group-${group.id}`}
    >
      <h2
        id={`app-nav-group-${group.id}`}
        role="presentation"
        class="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.12em] text-board-700"
      >
        {group.label}
      </h2>
      <div class="grid gap-0.5">
        {#each group.items as item (item.id)}
          {#if "href" in item}
            <a
              role="menuitem"
              href={resolve(item.href as "/")}
              class="menu-item flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-board-900 outline-none transition-colors hover:bg-board-100/75 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
              onclick={() => shell.closePanel()}
            >
              <item.icon size={19} aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          {:else if "formAction" in item}
            <form method="POST" action={item.formAction}>
              <button
                role="menuitem"
                type="submit"
                class="menu-item flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-board-900 outline-none transition-colors hover:bg-board-100/75 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
                class:text-danger={item.danger}
                onclick={() => shell.closePanel()}
              >
                <item.icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            </form>
          {:else}
            <button
              role="menuitem"
              type="button"
              class="menu-item flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-board-900 outline-none transition-colors hover:bg-board-100/75 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
              class:text-danger={item.danger}
              onclick={() => select(item.onSelect)}
            >
              <item.icon size={19} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          {/if}
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .nav-panel {
    animation: panel-in 160ms ease-out;
  }

  @keyframes panel-in {
    from {
      transform: translateY(-0.35rem) scale(0.98);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .nav-panel {
      animation: none;
    }
  }
</style>
