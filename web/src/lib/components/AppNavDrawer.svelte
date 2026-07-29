<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import {
    BookOpen,
    FileText,
    Gamepad2,
    House,
    ScrollText,
    ShieldCheck,
    Users,
    X,
  } from "@lucide/svelte";
  import { messages, siteContent } from "@shaxda/i18n";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { onMount, tick } from "svelte";
  import type { EasingFunction, TransitionConfig } from "svelte/transition";
  import { fade } from "svelte/transition";
  import { getAppShell } from "$lib/shell/appShell.svelte";

  interface Props {
    background: HTMLElement | null;
    opener: HTMLButtonElement | null;
  }

  interface SlidePanelParams {
    duration: number;
    easing: EasingFunction;
  }

  let { background, opener }: Props = $props();

  const shell = getAppShell();
  const nav = siteContent.so.nav;
  const footer = siteContent.so.footer;
  const sidebar = siteContent.so.sidebar;
  const navItems = [
    { href: "/", label: nav.home, icon: House },
    { href: "/local", label: nav.localPlay, icon: Gamepad2 },
    { href: "/online", label: nav.onlinePlay, icon: Users },
    { href: "/learn", label: nav.learn, icon: BookOpen },
    { href: "/rules", label: nav.rules, icon: ScrollText },
  ] as const;
  const footerItems = [
    { href: "/privacy", label: nav.privacy, icon: ShieldCheck },
    { href: "/terms", label: nav.terms, icon: FileText },
  ] as const;

  let prefersReducedMotion = $state(false);
  let drawer = $state<HTMLElement | null>(null);

  onMount(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      prefersReducedMotion = mediaQuery.matches;
    };

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  });

  $effect(() => {
    if (!shell.drawerOpen) {
      return;
    }

    const focusReturn =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : opener;
    const inertTarget = background;

    if (inertTarget !== null) {
      inertTarget.inert = true;
    }
    void tick().then(() => drawer?.focus());

    return () => {
      if (inertTarget !== null) {
        inertTarget.inert = false;
      }
      void tick().then(() => (focusReturn ?? opener)?.focus());
    };
  });

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Tab" || drawer === null) {
      return;
    }

    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);

    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === drawer)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (!shell.drawerOpen || event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    shell.close();
  }

  function slidePanel(
    _node: Element,
    { duration, easing }: SlidePanelParams,
  ): TransitionConfig {
    return {
      duration,
      easing,
      css: (t: number, u: number) =>
        `transform: translate3d(${-100 * u}%, 0, 0); opacity: ${0.4 + 0.6 * t}`,
    };
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if shell.drawerOpen}
  <div class="fixed inset-0 z-[60]">
    <button
      type="button"
      class="absolute inset-0 bg-board-900/45"
      aria-label={sidebar.closeMenu}
      data-testid="navigation-drawer-backdrop"
      onclick={() => shell.close()}
      in:fade={{ duration: prefersReducedMotion ? 0 : 220 }}
      out:fade={{ duration: prefersReducedMotion ? 0 : 170 }}
    ></button>

    <div
      bind:this={drawer}
      id="app-navigation-drawer"
      class="drawer-panel relative z-10 flex h-full w-[19rem] max-w-[86vw] flex-col overflow-y-auto overscroll-contain rounded-r-2xl border-r border-board-700/15 bg-board-50 shadow-2xl outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Hagaha bogga"
      tabindex="-1"
      onkeydown={handleKeydown}
      in:slidePanel={{
        duration: prefersReducedMotion ? 0 : 260,
        easing: cubicOut,
      }}
      out:slidePanel={{
        duration: prefersReducedMotion ? 0 : 200,
        easing: cubicIn,
      }}
    >
      <div
        class="flex items-center gap-2.5 border-b border-board-700/15 px-5 py-4"
      >
        <a
          href={resolve("/")}
          aria-label={messages.so.appName}
          class="inline-flex min-w-0 items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2"
          onclick={() => shell.close()}
        >
          <span
            class="grid size-9 shrink-0 place-items-center rounded-lg bg-board-900 text-base font-semibold text-board-50"
            aria-hidden="true"
          >
            S
          </span>
          <span class="truncate text-2xl font-semibold tracking-normal">
            {messages.so.appName}
          </span>
        </a>

        <button
          type="button"
          class="ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-board-700 outline-none transition-colors hover:bg-board-100/65 hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800 motion-reduce:transition-none"
          aria-label={sidebar.closeMenu}
          onclick={() => shell.close()}
        >
          <X size={21} aria-hidden="true" />
        </button>
      </div>

      <nav class="px-3 py-5" aria-label="Hagaha bogga">
        <ul class="grid gap-1">
          {#each navItems as item (item.href)}
            <li>
              <a
                href={resolve(item.href)}
                aria-label={item.label}
                aria-current={page.url.pathname === item.href
                  ? "page"
                  : undefined}
                class:active-navigation={page.url.pathname === item.href}
                class="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-board-700 outline-none transition-colors hover:bg-board-100/65 hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800"
                onclick={() => shell.close()}
              >
                <item.icon class="shrink-0" size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            </li>
          {/each}
        </ul>
      </nav>

      <div class="mt-auto border-t border-board-700/15 p-4">
        <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {#each footerItems as item (item.href)}
            <a
              aria-label={item.label}
              class="inline-flex min-h-11 items-center gap-2 rounded text-board-700 outline-none hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800"
              href={resolve(item.href)}
              onclick={() => shell.close()}
            >
              <item.icon class="shrink-0" size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          {/each}
        </div>
        <p class="mt-3 text-xs leading-5 text-board-700">
          {footer.tagline}
        </p>
      </div>
    </div>
  </div>
{/if}

<style>
  .drawer-panel {
    will-change: transform;
  }

  .active-navigation {
    background: color-mix(in srgb, var(--color-board-100) 78%, transparent);
    color: var(--color-board-900);
  }
</style>
