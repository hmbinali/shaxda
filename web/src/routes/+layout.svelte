<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import AnalyticsBeacon from "$lib/analytics/AnalyticsBeacon.svelte";
  import AppTopBar from "$lib/components/AppTopBar.svelte";
  import PwaNotices from "$lib/components/PwaNotices.svelte";
  import { createPwaController, setPwaController } from "$lib/pwa/pwa.svelte";
  import { createAppShell, setAppShell } from "$lib/shell/appShell.svelte";
  import { siteContent } from "@shaxda/i18n";
  import "../app.css";

  let { children } = $props();

  const pwa = createPwaController();
  const shell = createAppShell();
  setPwaController(pwa);
  setAppShell(shell);

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

        if (registration.waiting !== null) {
          pwa.setNeedRefresh(true);
        }

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
      } catch (error) {
        console.error(error);
      }
    }
  });
</script>

<AnalyticsBeacon />

<div class="flex h-dvh flex-col overflow-hidden bg-board-50 text-board-900">
  <div class="flex min-h-0 flex-1 flex-col" data-testid="shell-background">
    <a
      href="#main-content"
      class="fixed left-3 top-3 z-50 -translate-y-24 rounded-lg bg-board-900 px-4 py-2 text-sm font-semibold text-board-50 outline-none transition-transform focus:translate-y-0 focus:ring-2 focus:ring-focus focus:ring-offset-2 motion-reduce:transition-none"
    >
      {siteContent.so.topBar.skipToContent}
    </a>
    <PwaNotices />
    <AppTopBar pathname={page.url.pathname} />
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (the independently scrolling main region must be keyboard reachable) -->
    <main id="main-content" tabindex="0" class="min-w-0 flex-1 overflow-y-auto">
      {@render children()}
    </main>
  </div>
</div>
