import {
  clientMessageSchema,
  protocolVersion,
  serverMessageSchema,
} from "@shaxda/shared";
import type { GameAction } from "@shaxda/game-engine";
import type { ServerMessage } from "@shaxda/shared";
import { httpOrigin, wsOrigin } from "./workerOrigin";

export type OnlineConnectionStatus =
  "idle" | "connecting" | "connected" | "closed" | "error";

export interface JoinRoomOptions {
  roomCode: string;
  guestId: string;
  displayName?: string;
}

export interface OnlineGameClientCallbacks {
  onMessage?: (message: ServerMessage) => void;
  onStatus?: (status: OnlineConnectionStatus) => void;
  onError?: (error: Error) => void;
}

export interface OnlineGameClientOptions extends OnlineGameClientCallbacks {
  httpBase?: string;
  wsBase?: string;
  fetchFn?: typeof fetch;
  WebSocketCtor?: typeof WebSocket;
}

export class OnlineGameClient {
  #socket: WebSocket | null = null;
  #roomCode: string | null = null;
  #httpBase: string;
  #wsBase: string;
  #fetch: typeof fetch;
  #WebSocketCtor: typeof WebSocket;
  #callbacks: OnlineGameClientCallbacks;

  constructor(options: OnlineGameClientOptions = {}) {
    this.#httpBase = options.httpBase ?? httpOrigin();
    this.#wsBase = options.wsBase ?? wsOrigin(this.#httpBase);
    this.#fetch = options.fetchFn ?? fetch.bind(globalThis);
    this.#WebSocketCtor = options.WebSocketCtor ?? WebSocket;
    this.#callbacks = {
      onMessage: options.onMessage,
      onStatus: options.onStatus,
      onError: options.onError,
    };
  }

  async createRoom(): Promise<string> {
    const response = await this.#fetch(`${this.#httpBase}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Room could not be created.");
    }

    const message = serverMessageSchema.parse(await response.json());
    if (message.type !== "roomCreated") {
      throw new Error("Worker returned an unexpected room response.");
    }

    return message.roomCode;
  }

  connect(options: JoinRoomOptions): void {
    this.close();
    this.#roomCode = options.roomCode;
    this.emitStatus("connecting");

    const socket = new this.#WebSocketCtor(
      `${this.#wsBase}/rooms/${encodeURIComponent(options.roomCode)}/ws`,
    );
    this.#socket = socket;

    socket.addEventListener("open", () => {
      if (this.#socket !== socket) {
        return;
      }
      this.emitStatus("connected");
      socket.send(JSON.stringify(buildJoinMessage(options)));
    });

    socket.addEventListener("message", (event) => {
      if (this.#socket !== socket) {
        return;
      }
      try {
        const message = serverMessageSchema.parse(
          JSON.parse(String(event.data)),
        );
        this.#callbacks.onMessage?.(message);
      } catch (error) {
        this.emitError(toError(error));
      }
    });

    socket.addEventListener("close", () => {
      if (this.#socket !== socket) {
        return;
      }
      this.#socket = null;
      this.emitStatus("closed");
    });

    socket.addEventListener("error", () => {
      if (this.#socket !== socket) {
        return;
      }
      this.emitStatus("error");
      this.emitError(new Error("WebSocket connection failed."));
    });
  }

  sendGameAction(action: GameAction): boolean {
    if (
      this.#socket === null ||
      this.#roomCode === null ||
      this.#socket.readyState !== this.#WebSocketCtor.OPEN
    ) {
      return false;
    }

    const message = clientMessageSchema.parse({
      v: protocolVersion,
      type: "gameAction",
      roomCode: this.#roomCode,
      action,
    });
    this.#socket.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    const socket = this.#socket;
    this.#socket = null;
    this.#roomCode = null;
    socket?.close();
  }

  setCallbacks(callbacks: OnlineGameClientCallbacks): void {
    this.#callbacks = callbacks;
  }

  private emitStatus(status: OnlineConnectionStatus): void {
    this.#callbacks.onStatus?.(status);
  }

  private emitError(error: Error): void {
    this.#callbacks.onError?.(error);
  }
}

function buildJoinMessage(options: JoinRoomOptions): unknown {
  const displayName = options.displayName?.trim();

  return clientMessageSchema.parse({
    v: protocolVersion,
    type: "joinRoom",
    roomCode: options.roomCode,
    guestId: options.guestId,
    ...(displayName && displayName.length > 0 ? { displayName } : {}),
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown online error.");
}
