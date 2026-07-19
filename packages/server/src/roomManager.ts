import { randomBytes } from 'node:crypto';
import { ROOM_CODE_LENGTH } from '@tandem/shared';
import { GameRoom } from './gameRoom.js';

/** Unambiguous alphabet: no 0/O, 1/I/L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  get roomCount(): number {
    return this.rooms.size;
  }

  get playerCount(): number {
    let n = 0;
    for (const room of this.rooms.values()) n += room.playerCount;
    return n;
  }

  createRoom(): GameRoom {
    let code: string;
    do {
      code = this.generateCode();
    } while (this.rooms.has(code));
    const room = new GameRoom(code, (r) => this.rooms.delete(r.code));
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  private generateCode(): string {
    const bytes = randomBytes(ROOM_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    }
    return code;
  }
}
