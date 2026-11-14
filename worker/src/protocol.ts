import {
  claimWinClientMessageSchema,
  echoClientMessageSchema,
  gameActionClientMessageSchema,
  joinRoomClientMessageSchema,
  playerSlotSchema,
  pingClientMessageSchema,
  rateConsentClientMessageSchema,
  rematchClientMessageSchema,
  roomCodeSchema,
  roomOptionsSchema,
} from "@shaxda/shared";
import { z } from "zod";

export const roomInitRequestSchema = z.object({
  roomCode: roomCodeSchema,
  options: roomOptionsSchema.optional(),
});

export const roomInboundSchema = z.discriminatedUnion("type", [
  joinRoomClientMessageSchema,
  gameActionClientMessageSchema,
  claimWinClientMessageSchema,
  rateConsentClientMessageSchema,
  rematchClientMessageSchema,
  pingClientMessageSchema,
  echoClientMessageSchema,
]);

export type PlayerSlot = z.infer<typeof playerSlotSchema>;
export type RoomInboundMessage = z.infer<typeof roomInboundSchema>;
