<script lang="ts">
  import { onMount } from "svelte";
  import type { ActiveIdentity } from "@shaxda/shared/analytics/events";
  import { createActiveBeacon } from "./activeBeacon";

  let { identity }: { identity?: ActiveIdentity } = $props();

  onMount(() => {
    const record = createActiveBeacon();
    function onVisible() {
      if (document.visibilityState === "visible") void record(identity);
    }

    void record(identity);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  });
</script>
