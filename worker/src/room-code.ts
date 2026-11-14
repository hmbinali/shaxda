import {
  MATCH_ID_LENGTH,
  matchIdSchema,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  roomCodeSchema,
} from "@shaxda/shared";

export function generateRoomCode(): string {
  return roomCodeSchema.parse(randomCode(ROOM_CODE_LENGTH));
}

export function generateMatchId(): string {
  return matchIdSchema.parse(randomCode(MATCH_ID_LENGTH));
}

function randomCode(length: number): string {
  const characters: string[] = [];
  const maxAcceptedByte =
    Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length - 1;

  while (characters.length < length) {
    const bytes = new Uint8Array(length - characters.length);
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
      if (characters.length === length) {
        break;
      }
    }
  }

  return characters.join("");
}
