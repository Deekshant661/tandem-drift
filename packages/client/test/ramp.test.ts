import { describe, expect, it } from 'vitest';
import { ramp } from '../src/input/ramp.js';

describe('ramp', () => {
  it('moves toward the target without overshooting', () => {
    const r = ramp(0, 1, 7, 1 / 30); // 7 units/sec, one 30Hz tick
    expect(r).toBeCloseTo(7 / 30);
    expect(r).toBeLessThan(1);
  });

  it('snaps to the target when within one step', () => {
    expect(ramp(0.99, 1, 7, 1 / 30)).toBe(1);
  });

  it('ramps down toward a lower target too', () => {
    const r = ramp(1, 0, 7, 1 / 30);
    expect(r).toBeCloseTo(1 - 7 / 30);
  });

  it('reaches 1 after enough repeated steps', () => {
    let v = 0;
    for (let i = 0; i < 30; i++) v = ramp(v, 1, 7, 1 / 30);
    expect(v).toBe(1);
  });
});
