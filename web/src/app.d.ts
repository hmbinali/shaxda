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
    interface Locals {
      session: {
        id: string;
        userId: string;
        expiresAt: Date;
        token: string;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      user: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string | null;
        username?: string | null;
        avatarMode?: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
    }

    type AccountPageData =
      | null
      | { status: "incomplete" }
      | {
          status: "complete";
          username: string;
          avatarMode: "initial" | "google";
          imageUrl: string | null;
          avatarColor: string;
          initial: string;
        };

    interface PageData {
      account: AccountPageData;
    }

    interface Platform {
      env: import("$lib/server/auth/options").AuthEnvironment;
      context?: {
        waitUntil(promise: Promise<unknown>): void;
      };
      caches?: CacheStorage;
    }
  }
}

export {};
