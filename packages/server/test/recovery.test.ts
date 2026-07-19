import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { RoomManager } from '../src/roomManager.js';
import { isOutOfBounds, RECOVERY_COOLDOWN_TICKS } from '../src/gameRoom.js';

function fakeSocket(): WebSocket & { messages: unknown[] } {
  const messages: unknown[] = [];
  return {
    readyState: 1,
    OPEN: 1,
    send: vi.fn((data: string) => messages.push(JSON.parse(data))),
    messages,
  } as unknown as WebSocket & { messages: unknown[] };
}

function recoveredMessages(socket: ReturnType<typeof fakeSocket>): any[] {
  return socket.messages.filter((m: any) => m.type === 'recovered');
}

describe('isOutOfBounds', () => {
  it('is false for plausible in-world positions', () => {
    expect(isOutOfBounds(100, -50)).toBe(false);
    expect(isOutOfBounds(0, 0)).toBe(false);
  });

  it('is true far beyond any legitimate position', () => {
    expect(isOutOfBounds(10000, 0)).toBe(true);
    expect(isOutOfBounds(0, -50000, 3000)).toBe(true);
  });
});

describe('GameRoom recovery', () => {
  it('recovers to the map spawn pose before any checkpoint is passed', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom('track01');
    const pilot = fakeSocket();
    room.addPlayer('a', 'Ann', pilot);
    room.addPlayer('b', 'Bo', fakeSocket());

    room.requestRecover('a');
    const msgs = recoveredMessages(pilot);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].reason).toBe('manual');
    expect(msgs[0].vehicle.vx).toBe(0);
    expect(msgs[0].vehicle.vy).toBe(0);

    room.removePlayer('a');
    room.removePlayer('b');
  });

  it('ignores recovery requests from spectators', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom('track01');
    room.addPlayer('a', 'Ann', fakeSocket());
    room.addPlayer('b', 'Bo', fakeSocket());
    const spec = fakeSocket();
    room.addPlayer('s', 'Spec', spec);

    room.requestRecover('s');
    expect(recoveredMessages(spec)).toHaveLength(0);

    room.removePlayer('a');
    room.removePlayer('b');
    room.removePlayer('s');
  });

  it('rate-limits repeated recovery requests', () => {
    vi.useFakeTimers();
    try {
      const mgr = new RoomManager();
      const room = mgr.createRoom('track01');
      const pilot = fakeSocket();
      room.addPlayer('a', 'Ann', pilot);
      room.addPlayer('b', 'Bo', fakeSocket());

      room.requestRecover('a');
      room.requestRecover('a'); // immediate second request: within cooldown
      expect(recoveredMessages(pilot)).toHaveLength(1);

      // Advance real ticks by running the sim loop past the cooldown window.
      vi.advanceTimersByTime((RECOVERY_COOLDOWN_TICKS / 60) * 1000 + 50);
      room.requestRecover('a');
      expect(recoveredMessages(pilot)).toHaveLength(2);

      room.removePlayer('a');
      room.removePlayer('b');
    } finally {
      vi.useRealTimers();
    }
  });
});
