<script lang="ts">
  import AppTopBar from "$lib/components/AppTopBar.svelte";
  import {
    createAppShell,
    registerTopBar,
    setAppShell,
    type TopBarConfig,
  } from "./appShell.svelte";
  import type { AccountNavigationState } from "./topBarConfig";

  interface Props {
    config: TopBarConfig;
    pathname?: string;
    account?: AccountNavigationState;
  }

  let { config, pathname = "/test", account = null }: Props = $props();

  setAppShell(createAppShell());
  registerTopBar(() => config);
</script>

<AppTopBar {pathname} {account} />
