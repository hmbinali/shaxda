declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string;
          callback(token: string): void;
          "expired-callback"(): void;
          "error-callback"(): void;
        },
      ): string;
      reset(widgetId?: string): void;
      remove?(widgetId: string): void;
    };
  }

  namespace App {
    interface Platform {
      env?: Record<string, unknown>;
      context?: {
        waitUntil(promise: Promise<unknown>): void;
      };
      caches?: CacheStorage;
    }
  }
}

export {};
