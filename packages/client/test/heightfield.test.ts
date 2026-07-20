import { describe, expect, it } from 'vitest';
import { terrainHeight, type RoadFlattenPoint, type TerrainFeature } from '../src/scene/terrain/heightfield.js';

const road: RoadFlattenPoint[] = [
  { x: 0, y: 0, width: 8 },
  { x: 20, y: 0, width: 8 },
  { x: 40, y: 0, width: 8 },
];

describe('terrainHeight', () => {
  it('is exactly 0 on the road centerline', () => {
    for (const p of road) expect(terrainHeight(p.x, p.y, road, [], 1)).toBe(0);
  });

  it('is exactly 0 within the road margin, even with a huge hill right next to it', () => {
    const hill: TerrainFeature = { kind: 'hill', x: 20, y: 0, radius: 100, height: 40 };
    // Right at the road edge (width=8) plus most of the margin.
    expect(terrainHeight(20, 8 + 3, road, [hill], 1)).toBe(0);
  });

  it('rises toward an authored hill height well beyond the road', () => {
    const hill: TerrainFeature = { kind: 'hill', x: 20, y: 60, radius: 20, height: 15 };
    const h = terrainHeight(20, 60, road, [hill], 1); // far from road, at hill center
    expect(h).toBeGreaterThan(10);
  });

  it('dips for a valley feature', () => {
    const valley: TerrainFeature = { kind: 'valley', x: 20, y: 60, radius: 20, depth: 10 };
    const h = terrainHeight(20, 60, road, [valley], 1);
    expect(h).toBeLessThan(-6);
  });

  it('cliff drop is monotonic across the escarpment and matches its authored position', () => {
    const cliff: TerrainFeature = {
      kind: 'cliff',
      x1: 20,
      y1: 50,
      x2: 20,
      y2: 100,
      drop: 20,
      blend: 10,
    };
    // Sample far enough from the road that roadFactor is ~1, straddling the
    // escarpment line (x=20) within the blend band (10m either side).
    const before = terrainHeight(15, 60, road, [cliff], 1); // high side
    const at = terrainHeight(20, 60, road, [cliff], 1); // on the line
    const after = terrainHeight(25, 60, road, [cliff], 1); // low side
    expect(before).toBeGreaterThan(at);
    expect(at).toBeGreaterThan(after);
  });

  it('never returns NaN or negative-margin surprises near a mix of features', () => {
    const features: TerrainFeature[] = [
      { kind: 'hill', x: 0, y: 80, radius: 30, height: 20 },
      { kind: 'valley', x: 40, y: -80, radius: 25, depth: 8 },
    ];
    for (let x = -60; x <= 60; x += 10) {
      for (let y = -100; y <= 100; y += 10) {
        expect(Number.isFinite(terrainHeight(x, y, road, features, 42))).toBe(true);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = terrainHeight(55, 55, road, [], 7);
    const b = terrainHeight(55, 55, road, [], 7);
    expect(a).toBe(b);
  });
});
