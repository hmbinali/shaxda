<script lang="ts">
  import { onMount } from "svelte";
  import AnalyticsBeacon from "$lib/analytics/AnalyticsBeacon.svelte";
  import { createPwaController, setPwaController } from "$lib/pwa/pwa.svelte";
  import "../app.css";

  let { children } = $props();

  const pwa = createPwaController();
  setPwaController(pwa);

  onMount(() => {
    const cleanupBrowser = pwa.startBrowser({
      window,
      navigator,
      storage: window.localStorage,
    });
    let mounted = true;
    let reloadAfterControllerChange = false;
    let reloading = false;

    const reloadForUpdate = () => {
      if (reloading) {
        return;
      }

      reloading = true;
      window.location.reload();
    };

    const handleControllerChange = () => {
      if (reloadAfterControllerChange) {
        reloadForUpdate();
      }
    };

    navigator.serviceWorker?.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    if ("serviceWorker" in navigator) {
      void registerServiceWorker();
    }

    return () => {
      mounted = false;
      cleanupBrowser();
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };

    async function registerServiceWorker(): Promise<void> {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (!mounted) {
          return;
        }

        pwa.setUpdateServiceWorker(async () => {
          reloadAfterControllerChange = true;

          if (registration.waiting !== null) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
            return;
          }

          if (pwa.status.needRefresh) {
            reloadForUpdate();
            return;
          }

          await registration.update();
        });

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;

          worker?.addEventListener("statechange", () => {
            if (!mounted || worker.state !== "installed") {
              return;
            }

            if (navigator.serviceWorker.controller !== null) {
              pwa.setNeedRefresh(true);
            } else {
              pwa.setOfflineReady(true);
            }
          });
        });

        await navigator.serviceWorker.ready;

        if (mounted) {
          pwa.setOfflineReady(true);
        }
      } catch (error) {
        console.error(error);
      }
    }
  });
</script>

<AnalyticsBeacon />

{@render children()}
