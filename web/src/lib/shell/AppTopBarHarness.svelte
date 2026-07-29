<script lang="ts">
  import AppTopBar from "$lib/components/AppTopBar.svelte";
  import {
    createAppShell,
    registerTopBarActions,
    setAppShell,
    type TopBarAction,
  } from "./appShell.svelte";

  interface Props {
    actions: TopBarAction[];
  }

  let { actions }: Props = $props();

  setAppShell(createAppShell());
  registerTopBarActions(() => actions);
</script>

<AppTopBar />
