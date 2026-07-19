import { describe, expect, it } from 'vitest';
import {
  decodeClientMsg,
  decodeServerMsg,
  encode,
  sanitizeInput,
  type InputMsg,
  type SnapshotMsg,
} from '../src/protocol.js';

describe('protocol codec', () => {
  it('round-trips a client input message', () => {
    const msg: InputMsg = {
      type: 'input',
      seq: 42,
      input: { steer: -0.5, throttle: 1, brake: 0, handbrake: true },
    };
    expect(decodeClientMsg(encode(msg))).toEqual(msg);
  });

  it('round-trips a server snapshot message', () => {
    const msg: SnapshotMsg = {
      type: 'snapshot',
      tick: 300,
      vehicle: { x: 1, y: 2, angle: 0.3, vx: 4, vy: 5, angularVelocity: 0.1 },
      inputs: {
        pilot: { steer: 1, throttle: 0, brake: 0, handbrake: false },
        engineer: { steer: 0, throttle: 0.8, brake: 0, handbrake: false },
      },
      ack: { pilot: 41, engineer: -1 },
      race: { lap: 2, nextCheckpoint: 3, currentLapMs: 12500, lastLapMs: 61000, bestLapMs: null },
    };
    expect(decodeServerMsg(encode(msg))).toEqual(msg);
  });

  it('rejects malformed and wrong-direction messages', () => {
    expect(decodeClientMsg('not json')).toBeNull();
    expect(decodeClientMsg('42')).toBeNull();
    expect(decodeClientMsg('{"type":"snapshot"}')).toBeNull();
    expect(decodeClientMsg('{"type":"input","seq":1,"input":{"steer":"x"}}')).toBeNull();
    expect(decodeServerMsg('{"type":"input"}')).toBeNull();
  });

  it('clamps out-of-range and non-finite inputs', () => {
    expect(
      sanitizeInput({ steer: 5, throttle: -1, brake: Infinity, handbrake: false }),
    ).toEqual({ steer: 1, throttle: 0, brake: 0, handbrake: false });
    expect(sanitizeInput({ steer: NaN, throttle: 0.5, brake: 2, handbrake: true })).toEqual({
      steer: 0,
      throttle: 0.5,
      brake: 1,
      handbrake: true,
    });
  });
});
