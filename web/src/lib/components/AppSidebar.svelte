<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import {
    BookOpen,
    Gamepad2,
    House,
    Menu,
    ScrollText,
    Users,
    X,
  } from "@lucide/svelte";
  import { messages, siteContent } from "@shaxda/i18n";
  import { onMount, tick } from "svelte";
  import { fly } from "svelte/transition";

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

  let drawerOpen = $state(false);
  let prefersReducedMotion = $state(false);
  let drawer: HTMLElement | undefined = $state();
  let menuButton: HTMLButtonElement | undefined = $state();
  let previouslyFocused: HTMLElement | null = null;

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

  async function openDrawer(): Promise<void> {
    previouslyFocused =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : (menuButton ?? null);
    drawerOpen = true;
    await tick();
    drawer?.focus();
  }

  async function closeDrawer(restoreFocus = true): Promise<void> {
    if (!drawerOpen) {
      return;
    }

    drawerOpen = false;

    if (restoreFocus) {
      await tick();
      previouslyFocused?.focus();
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (drawerOpen && event.key === "Escape") {
      event.preventDefault();
      void closeDrawer();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet sidebarContent(instanceId: "desktop" | "mobile")}
  <div class="flex h-full flex-col">
    <div class="border-b border-board-700/15 px-5 py-5">
      <a
        href={resolve("/")}
        class="inline-flex rounded text-2xl font-semibold tracking-normal outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2"
        onclick={() => void closeDrawer()}
      >
        {messages.so.appName}
      </a>
    </div>

    <nav class="px-3 py-5" aria-label="Hagaha bogga">
      <ul class="grid gap-1">
        {#each navItems as item (item.href)}
          <li>
            <a
              href={resolve(item.href)}
              aria-current={page.url.pathname === item.href
                ? "page"
                : undefined}
              class:active-navigation={page.url.pathname === item.href}
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-board-700 outline-none transition-colors hover:bg-board-100/65 hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800"
              onclick={() => void closeDrawer()}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="mt-auto border-t border-board-700/15 p-3">
      <section
        class="rounded-xl border border-board-700/15 bg-white/45 p-3"
        aria-labelledby={`sidebar-account-heading-${instanceId}`}
      >
        <div class="flex items-center gap-3">
          <span
            class="grid size-9 shrink-0 place-items-center rounded-full bg-board-900 text-sm font-semibold text-board-50"
            aria-hidden="true"
          >
            M
          </span>
          <div class="min-w-0">
            <h2
              id={`sidebar-account-heading-${instanceId}`}
              class="text-sm font-semibold"
            >
              {sidebar.account}
            </h2>
            <p class="mt-0.5 text-xs text-board-700">
              {sidebar.accountPlaceholder}
            </p>
          </div>
        </div>
      </section>

      <div class="mt-4 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs">
        <a
          class="text-board-700 hover:text-board-900"
          href={resolve("/privacy")}
          onclick={() => void closeDrawer()}
        >
          {nav.privacy}
        </a>
        <a
          class="text-board-700 hover:text-board-900"
          href={resolve("/terms")}
          onclick={() => void closeDrawer()}
        >
          {nav.terms}
        </a>
      </div>
      <p class="mt-3 px-1 text-xs leading-5 text-board-700">
        {footer.tagline}
      </p>
    </div>
  </div>
{/snippet}

<header
  class="flex h-16 shrink-0 items-center justify-between border-b border-board-700/15 bg-board-50/95 px-4 lg:hidden"
>
  <a href={resolve("/")} class="text-xl font-semibold tracking-normal">
    {messages.so.appName}
  </a>
  <button
    bind:this={menuButton}
    type="button"
    class="inline-flex size-10 items-center justify-center rounded-lg text-board-900 outline-none hover:bg-board-100/65 focus-visible:ring-2 focus-visible:ring-red-800"
    aria-label={sidebar.openMenu}
    aria-expanded={drawerOpen}
    aria-controls="app-navigation-drawer"
    onclick={() => void openDrawer()}
  >
    <Menu size={22} aria-hidden="true" />
  </button>
</header>

<aside
  class="hidden w-64 shrink-0 border-r border-board-700/15 bg-board-50 lg:flex"
>
  {@render sidebarContent("desktop")}
</aside>

{#if drawerOpen}
  <div class="fixed inset-0 z-40 lg:hidden">
    <button
      type="button"
      class="absolute inset-0 bg-board-900/45"
      aria-label={sidebar.closeMenu}
      onclick={() => void closeDrawer()}
    ></button>
    <div
      bind:this={drawer}
      id="app-navigation-drawer"
      class="relative z-10 h-full w-64 max-w-[85vw] border-r border-board-700/15 bg-board-50 shadow-xl outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Hagaha bogga"
      tabindex="-1"
      in:fly={{
        x: -256,
        duration: prefersReducedMotion ? 0 : 180,
      }}
    >
      <button
        type="button"
        class="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-lg text-board-700 outline-none hover:bg-board-100/65 hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800"
        aria-label={sidebar.closeMenu}
        onclick={() => void closeDrawer()}
      >
        <X size={20} aria-hidden="true" />
      </button>
      {@render sidebarContent("mobile")}
    </div>
  </div>
{/if}

<style>
  .active-navigation {
    background: color-mix(in srgb, var(--color-board-100) 78%, transparent);
    color: var(--color-board-900);
  }
</style>
