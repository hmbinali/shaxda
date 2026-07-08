import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  roomCodeSchema,
} from "@shaxda/shared";

export function generateRoomCode(): string {
  const characters: string[] = [];
  const maxAcceptedByte =
    Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length - 1;

  while (characters.length < ROOM_CODE_LENGTH) {
    const bytes = new Uint8Array(ROOM_CODE_LENGTH - characters.length);
    crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte > maxAcceptedByte) {
        continue;
      }

      const character = ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
      if (!character) {
        continue;
      }

      characters.push(character);
      if (characters.length === ROOM_CODE_LENGTH) {
        break;
      }
    }
  }

  return roomCodeSchema.parse(characters.join(""));
}
