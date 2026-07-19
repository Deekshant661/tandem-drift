import { describe, expect, it } from 'vitest';
import { sampleRoad, willowbrook } from '@tandem/shared';
import { scatterWorld } from '../src/scene/environment/scatter.js';

describe('scatterWorld', () => {
  const world = willowbrook();

  it('is deterministic for the same seed', () => {
    const a = scatterWorld(world);
    const b = scatterWorld(world);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(300);
  });

  it('changes with a different seed', () => {
    const other = scatterWorld({ ...world, seed: world.seed + 1 });
    expect(other).not.toEqual(scatterWorld(world));
  });

  it('never places anything on the road', () => {
    const placements = scatterWorld(world);
    const samples = world.roads.flatMap((r) => sampleRoad(r, 6));
    for (const p of placements) {
      let minGap = Infinity;
      for (const s of samples) {
        minGap = Math.min(minGap, Math.hypot(p.x - s.x, p.y - s.y) - s.width);
      }
      expect(minGap).toBeGreaterThan(1);
    }
  });

  it('fills every zone kind that exists in the world', () => {
    const placements = scatterWorld(world);
    const zonesWithProps = new Set(placements.map((p) => p.zone));
    for (const z of world.zones) expect(zonesWithProps.has(z.kind)).toBe(true);
    expect(zonesWithProps.has('wild')).toBe(true);
  });

  it('houses appear in the village zone', () => {
    const houses = scatterWorld(world).filter((p) => p.kind === 'house');
    expect(houses.length).toBeGreaterThanOrEqual(6);
    for (const h of houses) expect(h.zone).toBe('village');
  });
});
