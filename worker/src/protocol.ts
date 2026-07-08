import {
  claimWinClientMessageSchema,
  echoClientMessageSchema,
  gameActionClientMessageSchema,
  joinRoomClientMessageSchema,
  playerSlotSchema,
  pingClientMessageSchema,
  roomCodeSchema,
} from "@shaxda/shared";
import { z } from "zod";

export const roomInitRequestSchema = z.object({
  roomCode: roomCodeSchema,
});

export const roomInboundSchema = z.discriminatedUnion("type", [
  joinRoomClientMessageSchema,
  gameActionClientMessageSchema,
  claimWinClientMessageSchema,
  pingClientMessageSchema,
  echoClientMessageSchema,
]);

export type PlayerSlot = z.infer<typeof playerSlotSchema>;
export type RoomInboundMessage = z.infer<typeof roomInboundSchema>;
