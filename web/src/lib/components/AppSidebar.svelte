<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    FileText,
    Gamepad2,
    House,
    Menu,
    ScrollText,
    ShieldCheck,
    Users,
    X,
  } from "@lucide/svelte";
  import { messages, siteContent } from "@shaxda/i18n";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { onMount, tick } from "svelte";
  import { fade, fly } from "svelte/transition";
  import {
    getSidebarPreferenceStorage,
    readSidebarCollapsed,
    writeSidebarCollapsed,
  } from "$lib/sidebar/preferences";

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

  let desktopCollapsed = $state(false);
  let desktopPreferenceReady = $state(false);
  let drawerOpen = $state(false);
  let prefersReducedMotion = $state(false);
  let drawer: HTMLElement | undefined = $state();
  let menuButton: HTMLButtonElement | undefined = $state();
  let preferenceStorage: Storage | null = null;
  let previouslyFocused: HTMLElement | null = null;

  onMount(() => {
    let mounted = true;
    preferenceStorage = getSidebarPreferenceStorage();
    desktopCollapsed = readSidebarCollapsed(preferenceStorage);

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      prefersReducedMotion = mediaQuery.matches;
    };

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    void tick().then(() => {
      if (mounted) {
        desktopPreferenceReady = true;
      }
    });

    return () => {
      mounted = false;
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  });

  function toggleDesktopSidebar(): void {
    desktopCollapsed = !desktopCollapsed;
    writeSidebarCollapsed(preferenceStorage, desktopCollapsed);
  }

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
  <div
    id={`app-sidebar-content-${instanceId}`}
    class="sidebar-content flex h-full min-w-0 flex-col"
  >
    <div class="sidebar-header border-b border-board-700/15 px-5 py-5">
      <a
        href={resolve("/")}
        aria-label={messages.so.appName}
        class:sidebar-tooltip={instanceId === "desktop"}
        data-tooltip={instanceId === "desktop"
          ? messages.so.appName
          : undefined}
        class="sidebar-brand inline-flex items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2"
        onclick={() => void closeDrawer()}
      >
        <span
          class="grid size-8 shrink-0 place-items-center rounded-lg bg-board-900 text-base font-semibold text-board-50"
          aria-hidden="true"
        >
          S
        </span>
        <span
          class="sidebar-collapsible-copy sidebar-brand-copy text-2xl font-semibold tracking-normal"
          aria-hidden="true"
        >
          {messages.so.appName}
        </span>
      </a>
    </div>

    <nav
      id={`app-sidebar-navigation-${instanceId}`}
      class="sidebar-nav px-3 py-5"
      aria-label="Hagaha bogga"
    >
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
              class:sidebar-tooltip={instanceId === "desktop"}
              data-tooltip={instanceId === "desktop" ? item.label : undefined}
              class="sidebar-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-board-700 outline-none transition-colors hover:bg-board-100/65 hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800"
              onclick={() => void closeDrawer()}
            >
              <item.icon class="shrink-0" size={18} aria-hidden="true" />
              <span class="sidebar-collapsible-copy sidebar-link-copy">
                {item.label}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="sidebar-footer mt-auto border-t border-board-700/15 p-3">
      {#if instanceId === "desktop"}
        <div class="sidebar-account-stage">
          <section
            class="sidebar-account-expanded rounded-xl border border-board-700/15 bg-white/45 p-3"
            aria-hidden={desktopCollapsed}
            aria-labelledby="sidebar-account-heading-desktop"
            data-testid="desktop-account-expanded"
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
                  id="sidebar-account-heading-desktop"
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
          <section
            class="sidebar-account-compact rounded-xl border border-board-700/15 bg-white/45"
            aria-hidden={!desktopCollapsed}
            aria-label={`${sidebar.account}: ${sidebar.accountPlaceholder}`}
            data-testid="desktop-account-compact"
          >
            <span
              class="grid size-9 place-items-center rounded-full bg-board-900 text-sm font-semibold text-board-50"
              aria-hidden="true"
            >
              M
            </span>
          </section>
        </div>
      {:else}
        <section
          class="rounded-xl border border-board-700/15 bg-white/45 p-3"
          aria-labelledby="sidebar-account-heading-mobile"
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
                id="sidebar-account-heading-mobile"
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
      {/if}

      <div
        class="sidebar-footer-links mt-4 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs"
      >
        {#each footerItems as item (item.href)}
          <a
            aria-label={item.label}
            class:sidebar-tooltip={instanceId === "desktop"}
            data-tooltip={instanceId === "desktop" ? item.label : undefined}
            class="sidebar-footer-link inline-flex items-center gap-2 rounded text-board-700 outline-none hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800"
            href={resolve(item.href)}
            onclick={() => void closeDrawer()}
          >
            <item.icon class="shrink-0" size={16} aria-hidden="true" />
            <span class="sidebar-collapsible-copy sidebar-footer-copy">
              {item.label}
            </span>
          </a>
        {/each}
      </div>
      <p
        class="sidebar-collapsible-copy sidebar-tagline mt-3 px-1 text-xs leading-5 text-board-700"
      >
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
    class="inline-flex size-10 items-center justify-center rounded-lg text-board-900 outline-none transition-colors hover:bg-board-100/65 focus-visible:ring-2 focus-visible:ring-red-800"
    aria-label={sidebar.openMenu}
    aria-expanded={drawerOpen}
    aria-controls="app-navigation-drawer"
    onclick={() => void openDrawer()}
  >
    <Menu size={22} aria-hidden="true" />
  </button>
</header>

<aside
  class:sidebar-ready={desktopPreferenceReady}
  class="desktop-sidebar relative z-20 hidden shrink-0 border-r border-board-700/15 bg-board-50 lg:flex"
  data-testid="desktop-sidebar"
  data-collapsed={desktopCollapsed}
>
  {@render sidebarContent("desktop")}
  <button
    type="button"
    class="sidebar-toggle absolute right-0 top-5 z-30 inline-flex size-8 translate-x-1/2 items-center justify-center rounded-full border border-board-700/20 bg-board-50 text-board-700 shadow-sm outline-none transition-[color,background-color,box-shadow,transform] hover:bg-board-100 hover:text-board-900 hover:shadow-md focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 motion-reduce:transition-none"
    aria-label={desktopCollapsed
      ? sidebar.expandSidebar
      : sidebar.collapseSidebar}
    aria-expanded={!desktopCollapsed}
    aria-controls="app-sidebar-content-desktop"
    title={desktopCollapsed ? sidebar.expandSidebar : sidebar.collapseSidebar}
    onclick={toggleDesktopSidebar}
  >
    {#if desktopCollapsed}
      <ChevronRight size={18} aria-hidden="true" />
    {:else}
      <ChevronLeft size={18} aria-hidden="true" />
    {/if}
  </button>
</aside>

{#if drawerOpen}
  <div class="fixed inset-0 z-40 lg:hidden">
    <button
      type="button"
      class="absolute inset-0 bg-board-900/45"
      aria-label={sidebar.closeMenu}
      onclick={() => void closeDrawer()}
      in:fade={{ duration: prefersReducedMotion ? 0 : 220 }}
      out:fade={{ duration: prefersReducedMotion ? 0 : 170 }}
    ></button>
    <div
      bind:this={drawer}
      id="app-navigation-drawer"
      class="relative z-10 h-full w-72 max-w-[85vw] border-r border-board-700/15 bg-board-50 shadow-xl outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Hagaha bogga"
      tabindex="-1"
      in:fly={{
        x: -288,
        duration: prefersReducedMotion ? 0 : 250,
        easing: cubicOut,
      }}
      out:fly={{
        x: -288,
        duration: prefersReducedMotion ? 0 : 180,
        easing: cubicIn,
      }}
    >
      <button
        type="button"
        class="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-lg text-board-700 outline-none transition-colors hover:bg-board-100/65 hover:text-board-900 focus-visible:ring-2 focus-visible:ring-red-800"
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
  .desktop-sidebar {
    --sidebar-expanded-width: clamp(16rem, 18vw, 18rem);

    width: var(--sidebar-expanded-width);
  }

  .desktop-sidebar.sidebar-ready {
    transition: width 240ms cubic-bezier(0.22, 0.72, 0.24, 1);
  }

  .desktop-sidebar.sidebar-ready[data-collapsed="true"] {
    transition-delay: 70ms;
  }

  .desktop-sidebar[data-collapsed="true"] {
    width: 4.5rem;
  }

  .sidebar-collapsible-copy {
    display: block;
    max-width: 14rem;
    opacity: 1;
    overflow: hidden;
    transform: translateX(0);
  }

  .sidebar-ready .sidebar-collapsible-copy {
    transition:
      max-width 230ms cubic-bezier(0.22, 0.72, 0.24, 1),
      opacity 160ms ease,
      transform 220ms cubic-bezier(0.22, 0.72, 0.24, 1);
  }

  .sidebar-brand-copy,
  .sidebar-link-copy,
  .sidebar-footer-copy {
    white-space: nowrap;
  }

  .sidebar-account-stage {
    position: relative;
    height: 4rem;
  }

  .sidebar-account-expanded,
  .sidebar-account-compact {
    position: absolute;
    left: 0;
    top: 0;
    min-height: 4rem;
  }

  .sidebar-account-expanded {
    width: calc(var(--sidebar-expanded-width) - 1.5rem);
    opacity: 1;
    transform: translateX(0);
  }

  .sidebar-account-compact {
    display: grid;
    width: 3.25rem;
    place-items: center;
    opacity: 0;
    pointer-events: none;
    transform: translateX(0.25rem);
  }

  .sidebar-ready .sidebar-account-expanded,
  .sidebar-ready .sidebar-account-compact {
    transition:
      opacity 120ms ease,
      transform 160ms cubic-bezier(0.22, 0.72, 0.24, 1);
  }

  .sidebar-ready .sidebar-account-expanded {
    transition-delay: 150ms;
  }

  .sidebar-ready .sidebar-account-compact {
    transition-duration: 70ms;
  }

  .sidebar-tagline {
    max-height: 5rem;
    max-width: 14rem;
  }

  .sidebar-ready .sidebar-tagline {
    transition:
      max-height 230ms cubic-bezier(0.22, 0.72, 0.24, 1),
      max-width 230ms cubic-bezier(0.22, 0.72, 0.24, 1),
      margin 230ms cubic-bezier(0.22, 0.72, 0.24, 1),
      opacity 160ms ease,
      transform 220ms cubic-bezier(0.22, 0.72, 0.24, 1);
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-collapsible-copy {
    max-width: 0;
    opacity: 0;
    pointer-events: none;
    transform: translateX(-0.4rem);
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-tagline {
    max-height: 0;
    margin-top: 0;
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-header {
    padding-inline: 1.25rem;
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-brand {
    gap: 0;
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-nav {
    padding-inline: 0.75rem;
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-link {
    justify-content: center;
    gap: 0;
    padding-inline: 0.625rem;
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-footer {
    padding-inline: 0.625rem;
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-account-expanded {
    opacity: 0;
    pointer-events: none;
    transform: translateX(-0.25rem);
  }

  .desktop-sidebar.sidebar-ready[data-collapsed="true"]
    .sidebar-account-expanded {
    transition-delay: 0ms;
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-account-compact {
    opacity: 1;
    transform: translateX(0);
  }

  .desktop-sidebar.sidebar-ready[data-collapsed="true"]
    .sidebar-account-compact {
    transition-delay: 190ms;
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-footer-links {
    display: grid;
    justify-items: center;
    gap: 0.25rem;
    padding-inline: 0;
  }

  .desktop-sidebar[data-collapsed="true"] .sidebar-footer-link {
    justify-content: center;
    gap: 0;
    padding: 0.5rem;
  }

  .sidebar-tooltip {
    position: relative;
  }

  .sidebar-tooltip::after {
    position: absolute;
    left: calc(100% + 0.75rem);
    top: 50%;
    z-index: 60;
    padding: 0.4rem 0.6rem;
    border: 1px solid rgb(110 67 39 / 0.18);
    border-radius: 0.45rem;
    background: var(--color-board-900);
    box-shadow: 0 0.5rem 1.2rem rgb(51 32 22 / 0.18);
    color: var(--color-board-50);
    content: attr(data-tooltip);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1rem;
    opacity: 0;
    pointer-events: none;
    transform: translate(0.35rem, -50%);
    transition:
      opacity 140ms ease,
      transform 180ms cubic-bezier(0.22, 0.72, 0.24, 1);
    white-space: nowrap;
  }

  .desktop-sidebar[data-collapsed="true"]
    .sidebar-tooltip:is(:hover, :focus-visible)::after {
    opacity: 1;
    transform: translate(0, -50%);
  }

  .sidebar-toggle:hover {
    transform: translateX(50%) scale(1.04);
  }

  .active-navigation {
    background: color-mix(in srgb, var(--color-board-100) 78%, transparent);
    color: var(--color-board-900);
  }

  @media (prefers-reduced-motion: reduce) {
    .desktop-sidebar,
    .sidebar-collapsible-copy,
    .sidebar-account-expanded,
    .sidebar-account-compact,
    .sidebar-tagline,
    .sidebar-tooltip::after {
      transition: none !important;
    }
  }
</style>
