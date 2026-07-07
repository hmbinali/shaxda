import { getContext, setContext } from "svelte";
import {
  PWA_INSTALL_DISMISSED_STORAGE_KEY,
  loadBooleanPreference,
  saveBooleanPreference,
  type PwaPreferenceStorage,
} from "./preferences";

export const PWA_CONTEXT_KEY = Symbol("shaxda-pwa-controller");

export interface PwaStatus {
  isOnline: boolean;
  offlineReady: boolean;
  needRefresh: boolean;
  installable: boolean;
  standalone: boolean;
  installDismissed: boolean;
}

export interface BrowserPwaEnvironment {
  window: Window;
  navigator: Navigator;
  storage: PwaPreferenceStorage | null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

type UpdateServiceWorker = () => Promise<void>;

export class PwaController {
  status = $state<PwaStatus>({
    isOnline: true,
    offlineReady: false,
    needRefresh: false,
    installable: false,
    standalone: false,
    installDismissed: false,
  });

  #deferredPrompt: BeforeInstallPromptEvent | null = null;
  #storage: PwaPreferenceStorage | null = null;
  #updateServiceWorker: UpdateServiceWorker | null = null;

  startBrowser({
    window,
    navigator,
    storage,
  }: BrowserPwaEnvironment): () => void {
    this.#storage = storage;
    this.status.isOnline = navigator.onLine;
    this.status.standalone = isStandalone(window, navigator);
    this.status.installDismissed = loadBooleanPreference(
      PWA_INSTALL_DISMISSED_STORAGE_KEY,
      storage,
    );
    this.refreshInstallable();

    const handleOnline = () => {
      this.status.isOnline = true;
    };
    const handleOffline = () => {
      this.status.isOnline = false;
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      this.#deferredPrompt = event as BeforeInstallPromptEvent;
      this.refreshInstallable();
    };
    const handleAppInstalled = () => {
      this.#deferredPrompt = null;
      this.status.standalone = true;
      this.dismissInstall();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }

  setOfflineReady(offlineReady: boolean): void {
    this.status.offlineReady = offlineReady;
  }

  setNeedRefresh(needRefresh: boolean): void {
    this.status.needRefresh = needRefresh;
  }

  setUpdateServiceWorker(updateServiceWorker: UpdateServiceWorker): void {
    this.#updateServiceWorker = updateServiceWorker;
  }

  async update(): Promise<void> {
    await this.#updateServiceWorker?.();
  }

  async promptInstall(): Promise<void> {
    const prompt = this.#deferredPrompt;

    if (prompt === null || !this.status.installable) {
      return;
    }

    await prompt.prompt();
    this.#deferredPrompt = null;
    this.refreshInstallable();
  }

  dismissInstall(): void {
    this.status.installDismissed = true;
    saveBooleanPreference(
      PWA_INSTALL_DISMISSED_STORAGE_KEY,
      true,
      this.#storage,
    );
    this.refreshInstallable();
  }

  private refreshInstallable(): void {
    this.status.installable =
      this.#deferredPrompt !== null &&
      !this.status.standalone &&
      !this.status.installDismissed;
  }
}

export function createPwaController(): PwaController {
  return new PwaController();
}

export function setPwaController(controller: PwaController): void {
  setContext(PWA_CONTEXT_KEY, controller);
}

export function getPwaController(): PwaController | null {
  return getContext<PwaController | null>(PWA_CONTEXT_KEY) ?? null;
}

function isStandalone(window: Window, navigator: Navigator): boolean {
  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)");
  const iosStandalone =
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return standaloneMedia?.matches === true || iosStandalone;
}
