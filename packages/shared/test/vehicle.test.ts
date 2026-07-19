import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../src/constants.js';
import { NEUTRAL_INPUT, type ControlInput } from '../src/protocol.js';
import {
  combineSeatInputs,
  createSimWorld,
  snapshotVehicle,
  stepSim,
  type SimWorld,
} from '../src/sim/vehicle.js';

function run(sim: SimWorld, input: Partial<ControlInput>, ticks: number): void {
  const full: ControlInput = { ...NEUTRAL_INPUT, ...input };
  for (let i = 0; i < ticks; i++) stepSim(sim, full, SIM_DT);
}

function speed(sim: SimWorld): number {
  const s = snapshotVehicle(sim);
  return Math.hypot(s.vx, s.vy);
}

describe('vehicle simulation', () => {
  it('stays at rest with neutral input', () => {
    const sim = createSimWorld();
    run(sim, {}, 60);
    expect(speed(sim)).toBeLessThan(0.01);
  });

  it('accelerates forward under throttle', () => {
    const sim = createSimWorld();
    run(sim, { throttle: 1 }, 120);
    const s = snapshotVehicle(sim);
    expect(s.y).toBeGreaterThan(5); // spawn faces +y
    expect(speed(sim)).toBeGreaterThan(10);
  });

  it('brakes to a stop', () => {
    const sim = createSimWorld();
    run(sim, { throttle: 1 }, 120);
    run(sim, { brake: 1 }, 180);
    expect(speed(sim)).toBeLessThan(0.5);
  });

  it('turns while moving but not while stationary', () => {
    const still = createSimWorld();
    run(still, { steer: 1 }, 60);
    expect(Math.abs(snapshotVehicle(still).angle)).toBeLessThan(0.02);

    const moving = createSimWorld();
    run(moving, { throttle: 1, steer: 1 }, 120);
    expect(Math.abs(snapshotVehicle(moving).angle)).toBeGreaterThan(0.3);
  });

  it('handbrake keeps lateral sliding alive (drift)', () => {
    const measureLateral = (handbrake: boolean): number => {
      const sim = createSimWorld();
      // 90 ticks of run-up: enough speed to drift, short enough to keep the
      // steering phase clear of the arena wall.
      run(sim, { throttle: 1 }, 90);
      run(sim, { steer: 1, handbrake }, 30);
      const s = snapshotVehicle(sim);
      // Lateral speed = velocity projected on the body's right axis,
      // which is local (1, 0) rotated by the body angle.
      const rightX = Math.cos(s.angle);
      const rightY = Math.sin(s.angle);
      return Math.abs(s.vx * rightX + s.vy * rightY);
    };
    // With handbrake, throttle cuts and grip drops; grip run should stay near zero lateral.
    expect(measureLateral(true)).toBeGreaterThan(measureLateral(false) + 0.5);
  });

  it('never escapes the arena walls', () => {
    const sim = createSimWorld();
    run(sim, { throttle: 1 }, 60 * 20);
    const s = snapshotVehicle(sim);
    expect(Math.abs(s.x)).toBeLessThan(70);
    expect(Math.abs(s.y)).toBeLessThan(50);
  });

  it('combines seat inputs with correct ownership', () => {
    const pilot: ControlInput = { steer: -1, throttle: 1, brake: 1, handbrake: true };
    const engineer: ControlInput = { steer: 1, throttle: 0.5, brake: 0.2, handbrake: false };
    expect(combineSeatInputs(pilot, engineer)).toEqual({
      steer: -1,
      throttle: 0.5,
      brake: 0.2,
      handbrake: false,
    });
  });
});
