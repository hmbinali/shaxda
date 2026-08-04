<script lang="ts">
  import type { Component } from "svelte";
  import AppTopBar from "$lib/components/AppTopBar.svelte";
  import { createAppShell, setAppShell } from "./appShell.svelte";
  import type { AccountNavigationState } from "./topBarConfig";

  interface Props {
    component?: Component;
    pathname?: string;
    account?: AccountNavigationState;
  }

  let {
    component: TestComponent,
    pathname = "/",
    account = null,
  }: Props = $props();

  const shell = createAppShell();
  setAppShell(shell);
</script>

<div data-testid="shell-background">
  <AppTopBar {pathname} {account} />
  <main data-testid="shell-main" class="overflow-y-auto">
    {#if TestComponent}
      <TestComponent />
    {/if}
  </main>
</div>
