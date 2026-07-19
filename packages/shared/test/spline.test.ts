import { describe, expect, it } from 'vitest';
import { sampleRoad } from '../src/world/spline.js';
import type { Road } from '../src/world/types.js';

const square: Road = {
  id: 'main',
  closed: true,
  points: [
    { x: -50, y: -50, z: 0, width: 8, surface: 'paved' },
    { x: 50, y: -50, z: 0, width: 8, surface: 'paved' },
    { x: 50, y: 50, z: 0, width: 8, surface: 'paved' },
    { x: -50, y: 50, z: 0, width: 8, surface: 'paved' },
  ],
};

describe('sampleRoad', () => {
  it('produces samplesPerSegment × points samples for a closed road', () => {
    expect(sampleRoad(square, 8)).toHaveLength(32);
  });

  it('passes through the control points at segment starts', () => {
    const s = sampleRoad(square, 8);
    expect(s[0]!.x).toBeCloseTo(-50);
    expect(s[0]!.y).toBeCloseTo(-50);
    expect(s[8]!.x).toBeCloseTo(50);
    expect(s[8]!.y).toBeCloseTo(-50);
  });

  it('yields unit tangents that follow travel direction', () => {
    const s = sampleRoad(square, 8);
    for (const p of s) expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 3);
    expect(s[4]!.tx).toBeGreaterThan(0.9); // mid bottom edge heads +x
  });

  it('interpolates width and keeps surface of the segment start', () => {
    const road: Road = {
      ...square,
      points: square.points.map((p, i) =>
        i === 1 ? { ...p, width: 16, surface: 'dirt' as const } : p,
      ),
    };
    const s = sampleRoad(road, 8);
    expect(s[4]!.width).toBeGreaterThan(8);
    expect(s[4]!.width).toBeLessThan(16);
    expect(s[8]!.surface).toBe('dirt');
  });

  it('clamps endpoints for open roads', () => {
    const open: Road = { ...square, closed: false };
    const s = sampleRoad(open, 8);
    expect(s).toHaveLength(24); // 3 segments
    expect(s[0]!.x).toBeCloseTo(-50);
  });
});
