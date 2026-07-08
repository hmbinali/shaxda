import {
  clientMessageSchema,
  protocolVersion,
  serverMessageSchema,
} from "@shaxda/shared";
import type { GameAction } from "@shaxda/game-engine";
import type { ServerMessage } from "@shaxda/shared";
import { httpOrigin, wsOrigin } from "./workerOrigin";

export type OnlineConnectionStatus =
  "idle" | "connecting" | "reconnecting" | "connected" | "closed" | "error";

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

export class OnlineCreateRoomError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "OnlineCreateRoomError";
  }
}

export class OnlineGameClient {
  static readonly reconnectDelaysMs = [1_000, 2_000, 4_000, 8_000, 10_000];

  #socket: WebSocket | null = null;
  #roomCode: string | null = null;
  #joinOptions: JoinRoomOptions | null = null;
  #intentionalClose = false;
  #reconnectAttempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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

  async createRoom(turnstileToken?: string): Promise<string> {
    const response = await this.#fetch(`${this.#httpBase}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(turnstileToken ? { turnstileToken } : {}),
    });

    if (!response.ok) {
      throw new OnlineCreateRoomError(await createRoomErrorCode(response));
    }

    const message = serverMessageSchema.parse(await response.json());
    if (message.type !== "roomCreated") {
      throw new Error("Worker returned an unexpected room response.");
    }

    return message.roomCode;
  }

  connect(options: JoinRoomOptions): void {
    this.cancelReconnect();
    this.closeSocket();
    this.#roomCode = options.roomCode;
    this.#joinOptions = { ...options };
    this.#intentionalClose = false;
    this.#reconnectAttempt = 0;
    this.emitStatus("connecting");
    this.openSocket(options);
  }

  private openSocket(options: JoinRoomOptions): void {
    const socket = new this.#WebSocketCtor(
      `${this.#wsBase}/rooms/${encodeURIComponent(options.roomCode)}/ws`,
    );
    this.#socket = socket;

    socket.addEventListener("open", () => {
      if (this.#socket !== socket) {
        return;
      }
      this.#reconnectAttempt = 0;
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
      if (!this.#intentionalClose) {
        this.scheduleReconnect();
        return;
      }
      this.emitStatus("closed");
    });

    socket.addEventListener("error", () => {
      if (this.#socket !== socket) {
        return;
      }
      this.emitError(new Error("WebSocket connection failed."));
      this.#socket = null;
      socket.close();
      if (!this.#intentionalClose) {
        this.scheduleReconnect();
        return;
      }
      this.emitStatus("error");
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

  sendClaimWin(roomCode = this.#roomCode): boolean {
    if (
      this.#socket === null ||
      roomCode === null ||
      this.#socket.readyState !== this.#WebSocketCtor.OPEN
    ) {
      return false;
    }

    const message = clientMessageSchema.parse({
      v: protocolVersion,
      type: "claimWin",
      roomCode,
    });
    this.#socket.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    this.#intentionalClose = true;
    this.cancelReconnect();
    this.closeSocket();
    this.#roomCode = null;
    this.#joinOptions = null;
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

  private scheduleReconnect(): void {
    if (this.#joinOptions === null || this.#intentionalClose) {
      return;
    }

    if (this.#reconnectAttempt >= OnlineGameClient.reconnectDelaysMs.length) {
      this.emitStatus("error");
      this.emitError(new Error("WebSocket reconnect failed."));
      return;
    }

    const delay = OnlineGameClient.reconnectDelaysMs[this.#reconnectAttempt];
    this.#reconnectAttempt += 1;
    this.emitStatus("reconnecting");
    this.cancelReconnect();
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      if (this.#joinOptions === null || this.#intentionalClose) {
        return;
      }
      this.openSocket(this.#joinOptions);
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
  }

  private closeSocket(): void {
    const socket = this.#socket;
    this.#socket = null;
    socket?.close();
  }
}

async function createRoomErrorCode(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    "code" in body &&
    typeof body.code === "string"
  ) {
    return body.code;
  }

  return "createFailed";
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
