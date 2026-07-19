import { describe, expect, it, vi } from 'vitest';
import { GameClient } from '../src/game/client.js';
import type { ServerMsg } from '@tandem/shared';

function fakeConnFactory() {
  const handlers: { open?: () => void; msg?: (m: ServerMsg) => void } = {};
  const conn = {
    rttMs: 42,
    sent: [] as unknown[],
    onOpen: (f: () => void) => {
      handlers.open = f;
    },
    onClose: (_f: () => void) => {},
    onMessage: (f: (m: ServerMsg) => void) => {
      handlers.msg = f;
    },
    send: (m: unknown) => conn.sent.push(m),
  };
  return { conn, handlers };
}

describe('GameClient state machine', () => {
  it('lobby → connecting → playing on joined', () => {
    const { conn, handlers } = fakeConnFactory();
    const gc = new GameClient({ createConnection: () => conn as never });
    const listener = vi.fn();
    gc.subscribe(listener);
    expect(gc.getState().phase).toBe('lobby');

    gc.join({ name: 'Ann', map: 'willowbrook' });
    expect(gc.getState().phase).toBe('connecting');
    handlers.open!();
    expect(conn.sent[0]).toMatchObject({ type: 'join', name: 'Ann', map: 'willowbrook' });

    handlers.msg!({
      type: 'joined',
      roomCode: 'ABCDEF',
      playerId: 'p',
      role: 'pilot',
      tick: 0,
      token: 'tok',
      map: 'willowbrook',
    });
    const s = gc.getState();
    expect(s.phase).toBe('playing');
    expect(s.role).toBe('pilot');
    expect(s.mapName).toBe('willowbrook');
    expect(listener).toHaveBeenCalled();
    gc.dispose();
  });

  it('getState returns the same reference until something changes', () => {
    const { conn } = fakeConnFactory();
    const gc = new GameClient({ createConnection: () => conn as never });
    expect(gc.getState()).toBe(gc.getState());
    gc.dispose();
  });

  it('tracks snapshots into race/speed state and poseRef', () => {
    const { conn, handlers } = fakeConnFactory();
    const gc = new GameClient({ createConnection: () => conn as never });
    gc.join({ name: 'Bo', map: 'willowbrook' });
    handlers.open!();
    handlers.msg!({
      type: 'joined',
      roomCode: 'ABCDEF',
      playerId: 'p',
      role: 'spectator',
      tick: 0,
      token: 't',
      map: 'willowbrook',
    });
    handlers.msg!({
      type: 'snapshot',
      tick: 30,
      vehicle: { x: 1, y: 2, angle: 0, vx: 3, vy: 4, angularVelocity: 0 },
      inputs: {
        pilot: { steer: 0, throttle: 0, brake: 0, handbrake: false },
        engineer: { steer: 0, throttle: 0, brake: 0, handbrake: false },
      },
      ack: { pilot: -1, engineer: -1 },
      race: { lap: 1, nextCheckpoint: 2, currentLapMs: 5, lastLapMs: null, bestLapMs: null },
    });
    expect(gc.getState().speedKmh).toBeCloseTo(5 * 3.6);
    expect(gc.getState().race?.lap).toBe(1);
    gc.samplePose(Date.now() + 10_000);
    expect(gc.poseRef.current?.x).toBe(1);
    gc.dispose();
  });

  it('rejects swap requests from spectators and outside play', () => {
    const { conn, handlers } = fakeConnFactory();
    const gc = new GameClient({ createConnection: () => conn as never });
    gc.requestSwap(); // lobby phase — ignored
    expect(gc.getState().swapPending).toBe(false);
    gc.join({ name: 'S', map: 'willowbrook' });
    handlers.open!();
    handlers.msg!({
      type: 'joined',
      roomCode: 'ABCDEF',
      playerId: 'p',
      role: 'spectator',
      tick: 0,
      token: 't',
      map: 'willowbrook',
    });
    gc.requestSwap();
    expect(gc.getState().swapPending).toBe(false);
    gc.dispose();
  });
});
