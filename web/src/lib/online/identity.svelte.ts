import {
  onlineIdentityStatusSchema,
  onlineIdentityTicketResponseSchema,
} from "@shaxda/shared";
import type { OnlineIdentityAccount } from "@shaxda/shared";
import type { TicketAction } from "@shaxda/shared/identity";

export type OnlineIdentityClientStatus =
  "loading" | "signedOut" | "incomplete" | "complete" | "unavailable";

export interface OnlineIdentityOptions {
  fetchFn?: typeof fetch;
  now?: () => number;
}

export class OnlineIdentity {
  status = $state<OnlineIdentityClientStatus>("loading");
  account = $state<OnlineIdentityAccount | null>(null);

  readonly #fetch: typeof fetch;
  readonly #now: () => number;

  constructor(options: OnlineIdentityOptions = {}) {
    this.#fetch = options.fetchFn ?? fetch.bind(globalThis);
    this.#now = options.now ?? Date.now;
  }

  async refresh(): Promise<void> {
    this.status = "loading";
    try {
      const response = await this.#fetch("/api/online/identity", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Online identity status failed.");
      const result = onlineIdentityStatusSchema.parse(await response.json());
      this.status = result.status;
      this.account = result.status === "complete" ? result.account : null;
    } catch {
      this.account = null;
      this.status = "unavailable";
    }
  }

  async requestTicket(
    action: TicketAction,
    roomCode?: string,
  ): Promise<string | null> {
    if (this.status !== "complete") return null;

    try {
      const response = await this.#fetch("/api/online/identity", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...(roomCode === undefined ? {} : { roomCode }),
        }),
      });
      if (!response.ok) throw new Error("identityUnavailable");
      const result = onlineIdentityTicketResponseSchema.parse(
        await response.json(),
      );
      if (result.expiresAt <= this.#now()) {
        throw new Error("identityExpired");
      }
      return result.ticket;
    } catch (error) {
      this.status = "unavailable";
      this.account = null;
      throw error;
    }
  }
}

export function createOnlineIdentity(
  options?: OnlineIdentityOptions,
): OnlineIdentity {
  return new OnlineIdentity(options);
}
