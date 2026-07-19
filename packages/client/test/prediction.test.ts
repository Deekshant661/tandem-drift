import { describe, expect, it } from 'vitest';
import {
  arenaMap,
  combineSeatInputs,
  createSimWorld,
  NEUTRAL_INPUT,
  SIM_DT,
  snapshotVehicle,
  stepSim,
  type ControlInput,
  type SnapshotMsg,
} from '@tandem/shared';
import { Predictor } from '../src/net/prediction.js';

const THROTTLE: ControlInput = { steer: 0, throttle: 1, brake: 0, handbrake: false };

/**
 * A miniature authoritative server: steps the same sim at 60 Hz, applies
 * engineer inputs by seq, and emits snapshots every 3 ticks.
 */
class MiniServer {
  readonly sim = createSimWorld(arenaMap());
  private tick = 0;
  private engineerInput: ControlInput = { ...NEUTRAL_INPUT };
  private engineerAck = -1;

  applyEngineerInput(seq: number, input: ControlInput): void {
    if (seq <= this.engineerAck) return;
    this.engineerAck = seq;
    this.engineerInput = input;
  }

  /** Step one tick; returns a snapshot on snapshot ticks. */
  step(): SnapshotMsg | null {
    stepSim(this.sim, combineSeatInputs(NEUTRAL_INPUT, this.engineerInput), SIM_DT);
    this.tick++;
    if (this.tick % 3 !== 0) return null;
    return {
      type: 'snapshot',
      tick: this.tick,
      vehicle: snapshotVehicle(this.sim),
      inputs: { pilot: { ...NEUTRAL_INPUT }, engineer: this.engineerInput },
      ack: { pilot: -1, engineer: this.engineerAck },
      race: { lap: 0, nextCheckpoint: -1, currentLapMs: 0, lastLapMs: null, bestLapMs: null },
    };
  }
}

describe('Predictor', () => {
  it('returns null before any server state arrives', () => {
    const p = new Predictor(arenaMap(), 'engineer');
    p.addLocalInput(1, THROTTLE); // ignored: nothing to predict from yet
    expect(p.sample()).toBeNull();
  });

  it('tracks the server closely when inputs arrive with zero latency', () => {
    const server = new MiniServer();
    const predictor = new Predictor(arenaMap(), 'engineer');
    let seq = 0;

    // 120 ticks (2 s): every 2nd tick the engineer issues throttle input to
    // both the server and the predictor, snapshots reconcile every 3rd tick.
    for (let tick = 0; tick < 120; tick++) {
      if (tick % 2 === 0) {
        seq++;
        server.applyEngineerInput(seq, THROTTLE);
        predictor.addLocalInput(seq, THROTTLE);
      }
      const snap = server.step();
      if (snap) predictor.onSnapshot(snap);
    }
    // Drain the smoothing offset, then compare poses.
    let pose = predictor.sample()!;
    for (let i = 0; i < 60; i++) pose = predictor.sample()!;
    const truth = snapshotVehicle(server.sim);
    expect(truth.y).toBeGreaterThan(5); // the car really moved
    expect(Math.hypot(pose.x - truth.x, pose.y - truth.y)).toBeLessThan(1.5);
  });

  it('reconciles away mispredictions using the server ack', () => {
    const server = new MiniServer();
    const predictor = new Predictor(arenaMap(), 'engineer');

    // Seed server state.
    const first = server.step() ?? server.step() ?? server.step();
    if (first) predictor.onSnapshot(first);

    // Predictor optimistically applies throttle the server never received
    // (packet loss): seq 1..5 predicted locally only.
    for (let seq = 1; seq <= 5; seq++) predictor.addLocalInput(seq, THROTTLE);
    const optimistic = predictor.sample()!;
    expect(Math.abs(optimistic.y)).toBeGreaterThan(0.01);

    // Server keeps idling and acks nothing; snapshots must pull the
    // prediction back toward the authoritative (stationary) car... but
    // unacked inputs keep replaying. Once the inputs are acked with no
    // effect (server applied neutral after them), prediction converges.
    for (let tick = 0; tick < 90; tick++) {
      server.applyEngineerInput(6, { ...NEUTRAL_INPUT }); // ack past the lost inputs
      const snap = server.step();
      if (snap) predictor.onSnapshot(snap);
    }
    let pose = predictor.sample()!;
    for (let i = 0; i < 120; i++) pose = predictor.sample()!;
    const truth = snapshotVehicle(server.sim);
    expect(Math.hypot(pose.x - truth.x, pose.y - truth.y)).toBeLessThan(0.5);
  });

  it('clears pending inputs on seat swap', () => {
    const server = new MiniServer();
    const predictor = new Predictor(arenaMap(), 'engineer');
    const snap = server.step() ?? server.step() ?? server.step();
    if (snap) predictor.onSnapshot(snap);

    predictor.addLocalInput(1, THROTTLE);
    predictor.setSeat('pilot');
    // After the swap, reconciling with an idle server should leave the car
    // essentially where the server says it is (no stale replays).
    for (let tick = 0; tick < 30; tick++) {
      const s = server.step();
      if (s) predictor.onSnapshot(s);
    }
    let pose = predictor.sample()!;
    for (let i = 0; i < 120; i++) pose = predictor.sample()!;
    const truth = snapshotVehicle(server.sim);
    expect(Math.hypot(pose.x - truth.x, pose.y - truth.y)).toBeLessThan(0.2);
  });
});
