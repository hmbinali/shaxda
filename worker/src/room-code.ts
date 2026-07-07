import { roomCodeSchema } from "@shaxda/shared";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 8;

export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);

  const roomCode = Array.from(
    bytes,
    (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length],
  ).join("");

  return roomCodeSchema.parse(roomCode);
}
