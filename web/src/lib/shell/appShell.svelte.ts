import type { Component } from "svelte";
import { getContext, setContext } from "svelte";

export const APP_SHELL_CONTEXT_KEY = Symbol("shaxda-app-shell");

export type TopBarAction = {
  id: string;
  label: string;
  icon: Component;
  onSelect: () => void;
  pressed?: boolean;
  tone?: "default" | "danger";
};

export class AppShellState {
  drawerOpen = $state(false);
  actions = $state<TopBarAction[]>([]);

  #owner: symbol | null = null;

  open(): void {
    this.drawerOpen = true;
  }

  close(): void {
    this.drawerOpen = false;
  }

  toggle(): void {
    this.drawerOpen = !this.drawerOpen;
  }

  setActions(owner: symbol, next: TopBarAction[]): void {
    this.#owner = owner;
    this.actions = next;
  }

  clearActions(owner: symbol): void {
    if (this.#owner !== owner) {
      return;
    }

    this.#owner = null;
    this.actions = [];
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

export function registerTopBarActions(getActions: () => TopBarAction[]): void {
  const shell = getAppShell();
  const owner = Symbol("top-bar-actions");

  $effect(() => {
    shell.setActions(owner, getActions());

    return () => shell.clearActions(owner);
  });
}
