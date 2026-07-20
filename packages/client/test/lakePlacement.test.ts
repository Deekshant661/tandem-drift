import { describe, expect, it } from 'vitest';
import { fernvale, sampleRoad } from '@tandem/shared';
import { computeSafeLakePlacement } from '../src/scene/environment/lakePlacement.js';

describe('computeSafeLakePlacement', () => {
  const samples = sampleRoad(fernvale().roads[0]!, 12);

  it('never overlaps the drivable corridor anywhere on the real Fernvale road', () => {
    // The hint is the "lake reveal" road point itself — exactly the
    // hand-picked coordinate that caused a real bug (a lake centered 2m
    // from this point, so the road drove straight through the water).
    const lake = computeSafeLakePlacement(samples, -100, -60, 26);
    for (const s of samples) {
      const dist = Math.hypot(lake.x - s.x, lake.y - s.y);
      expect(dist - s.width).toBeGreaterThanOrEqual(lake.radius);
    }
  });

  it('keeps the lake reasonably close to the hint (a real reveal, not a distant speck)', () => {
    const lake = computeSafeLakePlacement(samples, -100, -60, 26);
    const distFromHint = Math.hypot(lake.x - -100, lake.y - -60);
    expect(distFromHint).toBeLessThan(120);
  });

  it('is deterministic', () => {
    const a = computeSafeLakePlacement(samples, -100, -60, 26);
    const b = computeSafeLakePlacement(samples, -100, -60, 26);
    expect(a).toEqual(b);
  });
});
