import type { Component } from "svelte";
import { getContext, setContext } from "svelte";

export const APP_SHELL_CONTEXT_KEY = Symbol("shaxda-app-shell");

export type NavPanelItem =
  | { id: string; label: string; icon: Component; href: string }
  | {
      id: string;
      label: string;
      icon: Component;
      onSelect: () => void;
      danger?: boolean;
    };

export type NavPanelGroup = {
  id: string;
  label: string;
  items: NavPanelItem[];
};

export type TopBarAction = {
  id: string;
  label: string;
  shortLabel: string;
  icon: Component;
  onSelect?: () => void;
  panel?: "menu";
  pressed?: boolean;
  tone?: "default" | "danger";
  disabled?: boolean;
};

export type TopBarConfig = {
  actions: TopBarAction[];
  panels: NavPanelGroup[];
  brandGuard: (() => void) | null;
};

export class AppShellState {
  config = $state<TopBarConfig | null>(null);
  panel = $state<"menu" | null>(null);

  #owner: symbol | null = null;

  openPanel(panel: "menu"): void {
    this.panel = panel;
  }

  closePanel(): void {
    this.panel = null;
  }

  togglePanel(panel: "menu"): void {
    this.panel = this.panel === panel ? null : panel;
  }

  setTopBar(owner: symbol, config: TopBarConfig): void {
    this.#owner = owner;
    this.config = config;
  }

  clearTopBar(owner: symbol): void {
    if (this.#owner !== owner) {
      return;
    }

    this.#owner = null;
    this.config = null;
    this.closePanel();
  }
}

export function createAppShell(): AppShellState {
  return new AppShellState();
}

export function setAppShell(shell: AppShellState): void {
  setContext(APP_SHELL_CONTEXT_KEY, shell);
}

export function getAppShell(): AppShellState {
  const shell = getContext<AppShellState | undefined>(APP_SHELL_CONTEXT_KEY);

  if (shell === undefined) {
    throw new Error("App shell context is unavailable.");
  }

  return shell;
}

export function registerTopBar(getConfig: () => TopBarConfig): void {
  const shell = getAppShell();
  const owner = Symbol("top-bar");

  $effect(() => {
    shell.setTopBar(owner, getConfig());

    return () => shell.clearTopBar(owner);
  });
}
