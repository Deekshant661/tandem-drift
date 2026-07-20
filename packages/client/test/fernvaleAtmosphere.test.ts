import { describe, expect, it } from 'vitest';
import { atmosphereAt } from '../src/scene/environment/fernvaleAtmosphere.js';

function hexDelta(a: string, b: string): number {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ra = (pa >> 16) & 255, ga = (pa >> 8) & 255, ba = pa & 255;
  const rb = (pb >> 16) & 255, gb = (pb >> 8) & 255, bb = pb & 255;
  return Math.hypot(ra - rb, ga - gb, ba - bb);
}

describe('atmosphereAt', () => {
  it('is continuous everywhere: no large jump between neighboring samples', () => {
    const STEP = 0.005;
    let prev = atmosphereAt(0);
    for (let t = STEP; t <= 1; t += STEP) {
      const cur = atmosphereAt(t);
      // A discrete "zone switch" would show as a large single-step jump;
      // a continuous blend should never move more than a few units per step.
      expect(hexDelta(prev.fogColor, cur.fogColor)).toBeLessThan(20);
      expect(Math.abs(cur.fogNear - prev.fogNear)).toBeLessThan(20);
      prev = cur;
    }
  });

  it('is well-defined (no fallback gap) at every sampled position', () => {
    for (let t = 0; t < 1; t += 0.01) {
      const s = atmosphereAt(t);
      expect(Number.isFinite(s.fogNear)).toBe(true);
      expect(Number.isFinite(s.fogFar)).toBe(true);
      expect(s.fogColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('forest reads as the densest, dimmest, shortest-fog area', () => {
    const forest = atmosphereAt(0.47);
    const village = atmosphereAt(0.0);
    const lakeside = atmosphereAt(0.67);
    expect(forest.vegetationDensity).toBeGreaterThan(village.vegetationDensity);
    expect(forest.vegetationDensity).toBeGreaterThan(lakeside.vegetationDensity);
    expect(forest.fogFar).toBeLessThan(village.fogFar);
  });

  it('wraps around the loop seam (t near 1 resembles t near 0)', () => {
    const justBefore = atmosphereAt(0.995);
    const start = atmosphereAt(0.0);
    expect(hexDelta(justBefore.fogColor, start.fogColor)).toBeLessThan(15);
  });

  it('is deterministic', () => {
    expect(atmosphereAt(0.33)).toEqual(atmosphereAt(0.33));
  });
});
