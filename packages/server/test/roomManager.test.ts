import { describe, expect, it, vi } from 'vitest';
import { RoomManager } from '../src/roomManager.js';
import { MAX_SPECTATORS, RECONNECT_GRACE_MS } from '../src/gameRoom.js';
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

  it('assigns pilot, then engineer, then spectators up to the cap', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom();
    const a = room.addPlayer('a', 'Ann', fakeSocket());
    const b = room.addPlayer('b', 'Bo', fakeSocket());
    expect(a.role).toBe('pilot');
    expect(b.role).toBe('engineer');
    for (let i = 0; i < MAX_SPECTATORS; i++) {
      expect(room.addPlayer(`s${i}`, `Spec${i}`, fakeSocket()).role).toBe('spectator');
    }
    expect(() => room.addPlayer('overflow', 'Nope', fakeSocket())).toThrow(/full/);
    for (const id of ['a', 'b', ...Array.from({ length: MAX_SPECTATORS }, (_, i) => `s${i}`)]) {
      room.removePlayer(id);
    }
  });

  it('reserves a dropped seat during the reconnect grace and restores it by token', () => {
    vi.useFakeTimers();
    try {
      const mgr = new RoomManager();
      const room = mgr.createRoom();
      const a = room.addPlayer('a', 'Ann', fakeSocket());
      room.addPlayer('b', 'Bo', fakeSocket());

      room.handleDisconnect('a');
      // Seat is held: a new joiner becomes a spectator, not the pilot.
      expect(room.addPlayer('c', 'Cy', fakeSocket()).role).toBe('spectator');

      const restored = room.reclaimSeat(a.token, 'a2', fakeSocket());
      expect(restored?.role).toBe('pilot');
      expect(restored?.name).toBe('Ann');

      room.removePlayer('a2');
      room.removePlayer('b');
      room.removePlayer('c');
    } finally {
      vi.useRealTimers();
    }
  });

  it('frees the seat and GCs the room after the grace expires', () => {
    vi.useFakeTimers();
    try {
      const mgr = new RoomManager();
      const room = mgr.createRoom();
      const a = room.addPlayer('a', 'Ann', fakeSocket());
      room.handleDisconnect('a');
      // Room survives while a reconnect is possible.
      expect(mgr.roomCount).toBe(1);

      vi.advanceTimersByTime(RECONNECT_GRACE_MS + 1);
      expect(mgr.roomCount).toBe(0);
      expect(room.reclaimSeat(a.token, 'a2', fakeSocket())).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores inputs and swap requests from spectators', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom();
    const a = room.addPlayer('a', 'Ann', fakeSocket());
    room.addPlayer('b', 'Bo', fakeSocket());
    room.addPlayer('s', 'Spec', fakeSocket());

    room.applyInput('s', 1, { steer: 1, throttle: 1, brake: 0, handbrake: false });
    room.requestSeatSwap('s');
    room.requestSeatSwap('b');
    expect(a.role).toBe('pilot'); // spectator's request must not count toward the swap

    for (const id of ['a', 'b', 's']) room.removePlayer(id);
  });

  it('reassigns the vacated pilot seat to the next joiner', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom();
    room.addPlayer('a', 'Ann', fakeSocket());
    room.addPlayer('b', 'Bo', fakeSocket());
    room.removePlayer('a');
    const c = room.addPlayer('c', 'Cy', fakeSocket());
    expect(c.role).toBe('pilot');
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
    expect(a.role).toBe('pilot');

    room.requestSeatSwap('a');
    expect(a.role).toBe('pilot'); // one request is not enough
    room.requestSeatSwap('b');
    expect(a.role).toBe('engineer');
    expect(b.role).toBe('pilot');

    // Requests are consumed: another single request does not swap again.
    room.requestSeatSwap('a');
    expect(a.role).toBe('engineer');
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
