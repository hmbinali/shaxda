<script lang="ts">
  import type { Component } from "svelte";
  import AppTopBar from "$lib/components/AppTopBar.svelte";
  import { createAppShell, setAppShell } from "./appShell.svelte";

  interface Props {
    component?: Component;
    pathname?: string;
  }

  let { component: TestComponent, pathname = "/" }: Props = $props();

  const shell = createAppShell();
  setAppShell(shell);
</script>

<div data-testid="shell-background">
  <AppTopBar {pathname} />
  <main data-testid="shell-main" class="overflow-y-auto">
    {#if TestComponent}
      <TestComponent />
    {/if}
  </main>
</div>
