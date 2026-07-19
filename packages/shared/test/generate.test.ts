import { describe, expect, it } from 'vitest';
import { sampleRoad } from '../src/world/spline.js';
import {
  gatesFromSamples,
  wallsFromSamples,
  worldToTrackMap,
} from '../src/world/generate.js';
import type { Road, WorldMap } from '../src/world/types.js';

const circle: Road = {
  id: 'main',
  closed: true,
  points: Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return {
      x: Math.cos(a) * 60,
      y: Math.sin(a) * 60,
      z: 0,
      width: 8,
      surface: 'paved' as const,
    };
  }),
};

const world: WorldMap = {
  name: 'testworld',
  seed: 7,
  roads: [circle],
  spawn: { roadId: 'main', t: 0 },
  progress: { mode: 'lap', roadId: 'main', gates: 6 },
  zones: [],
  landmarks: [],
};

describe('wallsFromSamples', () => {
  it('creates two closed wall rings offset by the road width', () => {
    const samples = sampleRoad(circle, 6);
    const walls = wallsFromSamples(samples, true);
    expect(walls).toHaveLength(samples.length * 2);
    for (const w of walls) {
      const r = Math.hypot(w.x1, w.y1);
      expect(Math.abs(r - 60)).toBeGreaterThan(6);
      expect(Math.abs(r - 60)).toBeLessThan(10);
    }
  });
});

describe('gatesFromSamples', () => {
  it('places ordered gates on the centerline with width-scaled radius', () => {
    const samples = sampleRoad(circle, 6);
    const gates = gatesFromSamples(samples, 6);
    expect(gates).toHaveLength(6);
    for (const g of gates) {
      expect(Math.hypot(g.x, g.y)).toBeCloseTo(60, 0);
      expect(g.radius).toBeCloseTo(12, 1);
    }
  });
});

describe('worldToTrackMap', () => {
  it('produces a playable TrackMap: spawn on road, walls, gates', () => {
    const tm = worldToTrackMap(world);
    expect(tm.name).toBe('testworld');
    expect(Math.hypot(tm.spawn.x, tm.spawn.y)).toBeCloseTo(60, 0);
    expect(tm.walls.length).toBeGreaterThan(50);
    expect(tm.checkpoints).toHaveLength(6);
  });

  it('spawn angle faces the travel direction', () => {
    const tm = worldToTrackMap(world);
    // At t=0 (point (60,0) on a CCW circle), tangent ≈ (0,1);
    // forward (-sin a, cos a) must match → a ≈ 0.
    expect(Math.abs(tm.spawn.angle)).toBeLessThan(0.2);
  });

  it('throws for a missing progress road', () => {
    expect(() =>
      worldToTrackMap({ ...world, progress: { mode: 'lap', roadId: 'nope', gates: 3 } }),
    ).toThrow(/not found/);
  });
});
