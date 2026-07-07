import { afterEach, describe, expect, it, vi } from "vitest";
import { PWA_INSTALL_DISMISSED_STORAGE_KEY } from "./preferences";
import { createPwaController } from "./pwa.svelte";

const originalMatchMedia = Object.getOwnPropertyDescriptor(
  window,
  "matchMedia",
);

describe("PwaController", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    vi.restoreAllMocks();
    if (originalMatchMedia === undefined) {
      Reflect.deleteProperty(window, "matchMedia");
    } else {
      Object.defineProperty(window, "matchMedia", originalMatchMedia);
    }
    window.localStorage.clear();
  });

  it("does not touch browser globals before browser start", () => {
    const controller = createPwaController();

    expect(controller.status.installable).toBe(false);
    expect(controller.status.installDismissed).toBe(false);
  });

  it("tracks online and offline browser events", () => {
    const controller = createPwaController();
    cleanups.push(
      controller.startBrowser({
        window,
        navigator: { onLine: true } as Navigator,
        storage: window.localStorage,
      }),
    );

    expect(controller.status.isOnline).toBe(true);

    window.dispatchEvent(new Event("offline"));
    expect(controller.status.isOnline).toBe(false);

    window.dispatchEvent(new Event("online"));
    expect(controller.status.isOnline).toBe(true);
  });

  it("tracks service worker readiness and refresh state", async () => {
    const controller = createPwaController();
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);

    controller.setOfflineReady(true);
    controller.setNeedRefresh(true);
    controller.setUpdateServiceWorker(updateServiceWorker);

    expect(controller.status.offlineReady).toBe(true);
    expect(controller.status.needRefresh).toBe(true);
    await expect(controller.update()).resolves.toBeUndefined();
    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it("tracks install prompt availability and dismissal", async () => {
    const controller = createPwaController();
    cleanups.push(
      controller.startBrowser({
        window,
        navigator: { onLine: true } as Navigator,
        storage: window.localStorage,
      }),
    );
    const event = createBeforeInstallPromptEvent();
    const preventDefault = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(controller.status.installable).toBe(true);

    controller.dismissInstall();

    expect(controller.status.installable).toBe(false);
    expect(window.localStorage.getItem(PWA_INSTALL_DISMISSED_STORAGE_KEY)).toBe(
      "true",
    );

    await controller.promptInstall();
    expect(event.prompt).not.toHaveBeenCalled();
  });

  it("suppresses install UI while standalone", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const controller = createPwaController();
    cleanups.push(
      controller.startBrowser({
        window,
        navigator: { onLine: true } as Navigator,
        storage: window.localStorage,
      }),
    );

    window.dispatchEvent(createBeforeInstallPromptEvent());

    expect(controller.status.standalone).toBe(true);
    expect(controller.status.installable).toBe(false);
  });

  it("tolerates throwing preference storage", () => {
    const controller = createPwaController();

    expect(() =>
      cleanups.push(
        controller.startBrowser({
          window,
          navigator: { onLine: true } as Navigator,
          storage: {
            getItem: () => {
              throw new Error("getItem failed");
            },
            setItem: () => {
              throw new Error("setItem failed");
            },
            removeItem: () => {
              throw new Error("removeItem failed");
            },
          },
        }),
      ),
    ).not.toThrow();

    window.dispatchEvent(createBeforeInstallPromptEvent());
    expect(() => controller.dismissInstall()).not.toThrow();
  });
});

function createBeforeInstallPromptEvent(): Event & {
  prompt: ReturnType<typeof vi.fn>;
} {
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as Event & { prompt: ReturnType<typeof vi.fn> };
  event.prompt = vi.fn().mockResolvedValue(undefined);

  return event;
}
