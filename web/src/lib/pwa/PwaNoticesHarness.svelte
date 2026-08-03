<script lang="ts">
  import PwaNotices from "$lib/components/PwaNotices.svelte";
  import { createPwaController, setPwaController } from "./pwa.svelte";

  const controller = createPwaController();
  controller.setOfflineReady(true);
  setPwaController(controller);
</script>

<PwaNotices />
