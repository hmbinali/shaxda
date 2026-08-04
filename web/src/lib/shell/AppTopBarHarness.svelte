<script lang="ts">
  import AppTopBar from "$lib/components/AppTopBar.svelte";
  import {
    createAppShell,
    registerTopBar,
    setAppShell,
    type TopBarConfig,
  } from "./appShell.svelte";

  interface Props {
    config: TopBarConfig;
    pathname?: string;
  }

  let { config, pathname = "/test" }: Props = $props();

  setAppShell(createAppShell());
  registerTopBar(() => config);
</script>

<AppTopBar {pathname} />
