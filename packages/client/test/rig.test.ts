import { describe, expect, it } from 'vitest';
import { computeRigPose } from '../src/scene/characters/rig.js';

const base = {
  seat: 'pilot' as const,
  speed: 20,
  steer: 0,
  throttle: 0,
  brake: 0,
  collision: 0,
  time: 0,
};

describe('computeRigPose', () => {
  it('leans back under throttle and forward under braking', () => {
    expect(computeRigPose({ ...base, throttle: 1 }).leanPitch).toBeGreaterThan(0);
    expect(computeRigPose({ ...base, brake: 1 }).leanPitch).toBeLessThan(0);
  });

  it('leans outward when cornering, scaled by speed', () => {
    const fast = computeRigPose({ ...base, steer: 1 });
    const slow = computeRigPose({ ...base, steer: 1, speed: 3 });
    expect(fast.leanRoll).toBeLessThan(0); // steering right → lean left (outward)
    expect(Math.abs(fast.leanRoll)).toBeGreaterThan(Math.abs(slow.leanRoll));
  });

  it('only the pilot turns their head toward steering', () => {
    expect(computeRigPose({ ...base, steer: -1 }).headYaw).toBeLessThan(0);
    expect(computeRigPose({ ...base, seat: 'engineer', steer: -1 }).headYaw).toBe(0);
  });

  it('collision produces a vertical jolt', () => {
    expect(computeRigPose({ ...base, collision: 1 }).joltY).toBeGreaterThan(0.1);
    expect(computeRigPose(base).joltY).toBe(0);
  });

  it('bounce is phase-offset between seats so riders desync', () => {
    const t = 1.7;
    const p = computeRigPose({ ...base, time: t }).bounceY;
    const e = computeRigPose({ ...base, seat: 'engineer', time: t }).bounceY;
    expect(p).not.toBeCloseTo(e, 4);
  });
});
