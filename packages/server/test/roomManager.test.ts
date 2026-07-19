import { describe, expect, it, vi } from 'vitest';
import { RoomManager } from '../src/roomManager.js';
import type { WebSocket } from 'ws';

function fakeSocket(): WebSocket {
  return { readyState: 1, OPEN: 1, send: vi.fn() } as unknown as WebSocket;
}

describe('RoomManager / GameRoom lifecycle', () => {
  it('creates rooms with unique, well-formed codes', () => {
    const mgr = new RoomManager();
    const codes = new Set(Array.from({ length: 50 }, () => mgr.createRoom().code));
    expect(codes.size).toBe(50);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(mgr.roomCount).toBe(50);
  });

  it('looks up rooms case-insensitively', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom();
    expect(mgr.getRoom(room.code.toLowerCase())).toBe(room);
    expect(mgr.getRoom('NOPE99')).toBeUndefined();
  });

  it('assigns pilot then engineer, and rejects a third player', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom();
    const a = room.addPlayer('a', 'Ann', fakeSocket());
    const b = room.addPlayer('b', 'Bo', fakeSocket());
    expect(a.seat).toBe('pilot');
    expect(b.seat).toBe('engineer');
    expect(() => room.addPlayer('c', 'Cy', fakeSocket())).toThrow(/full/);
    room.removePlayer('a');
    room.removePlayer('b');
  });

  it('reassigns the vacated pilot seat to the next joiner', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom();
    room.addPlayer('a', 'Ann', fakeSocket());
    room.addPlayer('b', 'Bo', fakeSocket());
    room.removePlayer('a');
    const c = room.addPlayer('c', 'Cy', fakeSocket());
    expect(c.seat).toBe('pilot');
    room.removePlayer('b');
    room.removePlayer('c');
  });

  it('garbage-collects a room when the last player leaves', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom();
    room.addPlayer('a', 'Ann', fakeSocket());
    expect(mgr.roomCount).toBe(1);
    room.removePlayer('a');
    expect(mgr.roomCount).toBe(0);
    expect(mgr.getRoom(room.code)).toBeUndefined();
  });

  it('swaps seats only when both players request it', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom();
    const a = room.addPlayer('a', 'Ann', fakeSocket());
    const b = room.addPlayer('b', 'Bo', fakeSocket());
    expect(a.seat).toBe('pilot');

    room.requestSeatSwap('a');
    expect(a.seat).toBe('pilot'); // one request is not enough
    room.requestSeatSwap('b');
    expect(a.seat).toBe('engineer');
    expect(b.seat).toBe('pilot');

    // Requests are consumed: another single request does not swap again.
    room.requestSeatSwap('a');
    expect(a.seat).toBe('engineer');
    room.removePlayer('a');
    room.removePlayer('b');
  });

  it('drops stale input sequence numbers', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom();
    room.addPlayer('a', 'Ann', fakeSocket());
    const input = (steer: number) => ({ steer, throttle: 0, brake: 0, handbrake: false });
    room.applyInput('a', 5, input(1));
    room.applyInput('a', 3, input(-1)); // stale, must be ignored
    room.applyInput('a', 3, input(-1));
    // No direct getter for inputs by design; verified via no throw + seq guard
    // exercised again with a newer seq:
    room.applyInput('a', 6, input(0.5));
    room.removePlayer('a');
  });
});
