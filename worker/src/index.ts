import {
  appMetadata,
  healthResponseSchema,
  protocolVersion,
  roomCodeSchema,
  serverMessageSchema,
} from "@shaxda/shared";
import { MatchRoom } from "./match-room";
import { generateRoomCode } from "./room-code";

const MAX_ROOM_CREATION_ATTEMPTS = 5;

interface Env {
  MATCH_ROOM: DurableObjectNamespace;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json(
        healthResponseSchema.parse({ ok: true, service: appMetadata.id }),
      );
    }

    if (request.method === "POST" && url.pathname === "/rooms") {
      for (
        let attempt = 0;
        attempt < MAX_ROOM_CREATION_ATTEMPTS;
        attempt += 1
      ) {
        const roomCode = generateRoomCode();
        const id = env.MATCH_ROOM.idFromName(roomCode);
        const room = env.MATCH_ROOM.get(id);
        const initResponse = await room.fetch(
          new Request(new URL("/internal/rooms/init", url.origin), {
            method: "POST",
            body: JSON.stringify({ roomCode }),
            headers: { "Content-Type": "application/json" },
          }),
        );

        if (initResponse.status === 409) {
          continue;
        }

        if (!initResponse.ok) {
          return Response.json(
            { error: "Room could not be created" },
            { status: 500 },
          );
        }

        return Response.json(
          serverMessageSchema.parse({
            v: protocolVersion,
            type: "roomCreated",
            roomCode,
          }),
        );
      }

      return Response.json(
        { error: "Unique room code could not be allocated" },
        { status: 503 },
      );
    }

    const roomMatch = /^\/rooms\/([^/]+)\/ws$/.exec(url.pathname);
    if (request.method === "GET" && roomMatch) {
      const roomCode = roomCodeSchema.safeParse(roomMatch[1]);
      if (!roomCode.success) {
        return Response.json({ error: "Invalid room code" }, { status: 400 });
      }

      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return Response.json(
          { error: "Expected WebSocket upgrade" },
          { status: 426 },
        );
      }

      const id = env.MATCH_ROOM.idFromName(roomCode.data);
      const room = env.MATCH_ROOM.get(id);
      return room.fetch(request);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export default worker;
export { MatchRoom };
