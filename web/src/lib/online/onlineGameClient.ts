import {
  clientMessageSchema,
  protocolVersion,
  serverMessageSchema,
} from "@shaxda/shared";
import type { GameAction } from "@shaxda/game-engine";
import type { ServerMessage } from "@shaxda/shared";
import type { TicketAction } from "@shaxda/shared/identity";
import { httpOrigin, wsOrigin } from "./workerOrigin";

export type OnlineConnectionStatus =
  | "idle"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "closed"
  | "replaced"
  | "error";
export type RoomTicketAction = Exclude<TicketAction, "create">;

export interface JoinRoomOptions {
  roomCode: string;
  guestId: string;
  displayName?: string;
  requestTicket?: (
    action: RoomTicketAction,
    roomCode: string,
  ) => Promise<string | null>;
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
  #hasOpened = false;
  #scopeFallbackUsed = false;
  #lastJoinAction: RoomTicketAction | null = null;
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

  async createRoom(
    turnstileToken?: string,
    identityTicket?: string,
  ): Promise<string> {
    const body = {
      ...(turnstileToken ? { turnstileToken } : {}),
      ...(identityTicket ? { identityTicket } : {}),
    };
    const response = await this.#fetch(`${this.#httpBase}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    this.#hasOpened = false;
    this.#scopeFallbackUsed = false;
    this.#lastJoinAction = null;
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
      const action: RoomTicketAction = this.#hasOpened ? "reconnect" : "join";
      this.#hasOpened = true;
      void this.sendJoin(socket, options, action);
    });

    socket.addEventListener("message", (event) => {
      if (this.#socket !== socket) {
        return;
      }
      try {
        const message = serverMessageSchema.parse(
          JSON.parse(String(event.data)),
        );
        void this.handleInboundMessage(socket, options, message);
      } catch (error) {
        this.emitError(toError(error));
      }
    });

    socket.addEventListener("close", (event) => {
      if (this.#socket !== socket) {
        return;
      }
      this.#socket = null;
      if (event instanceof CloseEvent && event.code === 4001) {
        this.#intentionalClose = true;
        this.cancelReconnect();
        this.emitStatus("replaced");
        return;
      }
      if (event instanceof CloseEvent && event.code === 4003) {
        this.#intentionalClose = true;
        this.cancelReconnect();
        this.emitStatus("closed");
        return;
      }
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

  private async sendJoin(
    socket: WebSocket,
    options: JoinRoomOptions,
    action: RoomTicketAction,
  ): Promise<void> {
    try {
      const identityTicket = options.requestTicket
        ? await options.requestTicket(action, options.roomCode)
        : null;
      if (
        this.#socket !== socket ||
        socket.readyState !== this.#WebSocketCtor.OPEN
      ) {
        return;
      }
      this.#lastJoinAction = action;
      socket.send(
        JSON.stringify(buildJoinMessage(options, identityTicket ?? undefined)),
      );
    } catch (error) {
      if (this.#socket !== socket) return;
      this.#intentionalClose = true;
      this.emitError(toError(error));
      socket.close();
    }
  }

  private async handleInboundMessage(
    socket: WebSocket,
    options: JoinRoomOptions,
    message: ServerMessage,
  ): Promise<void> {
    if (
      message.type === "error" &&
      message.code === "identityScope" &&
      this.#lastJoinAction === "reconnect" &&
      !this.#scopeFallbackUsed
    ) {
      this.#scopeFallbackUsed = true;
      await this.sendJoin(socket, options, "join");
      return;
    }

    this.#callbacks.onMessage?.(message);
    if (
      message.type === "error" &&
      terminalIdentityErrorCodes.has(message.code)
    ) {
      this.#intentionalClose = true;
      this.cancelReconnect();
      socket.close();
    }
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

const terminalIdentityErrorCodes = new Set([
  "identityInvalid",
  "identityExpired",
  "identityScope",
  "identityReplayed",
  "identityUnavailable",
]);

function buildJoinMessage(
  options: JoinRoomOptions,
  identityTicket?: string,
): unknown {
  const displayName = options.displayName?.trim();

  return clientMessageSchema.parse({
    v: protocolVersion,
    type: "joinRoom",
    roomCode: options.roomCode,
    guestId: options.guestId,
    ...(displayName && displayName.length > 0 ? { displayName } : {}),
    ...(identityTicket ? { identityTicket } : {}),
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown online error.");
}
