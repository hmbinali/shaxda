<script lang="ts">
  import type { Component } from "svelte";
  import AppNavDrawer from "$lib/components/AppNavDrawer.svelte";
  import AppTopBar from "$lib/components/AppTopBar.svelte";
  import { createAppShell, setAppShell } from "./appShell.svelte";

  interface Props {
    component?: Component;
    withDrawer?: boolean;
  }

  let { component: TestComponent, withDrawer = false }: Props = $props();

  const shell = createAppShell();
  setAppShell(shell);

  let background = $state<HTMLElement | null>(null);
  let menuButton = $state<HTMLButtonElement | null>(null);
</script>

<div bind:this={background} data-testid="shell-background">
  <AppTopBar bind:menuButton />
  <main
    data-testid="shell-main"
    class:overflow-y-auto={!shell.drawerOpen}
    class:overflow-hidden={shell.drawerOpen}
  >
    {#if TestComponent}
      <TestComponent />
    {/if}
  </main>
</div>

{#if withDrawer}
  <AppNavDrawer {background} opener={menuButton} />
{/if}
