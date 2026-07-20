import { describe, expect, it } from 'vitest';
import { fernvale } from '../src/world/fernvale.js';
import { worldToTrackMap } from '../src/world/generate.js';
import { sampleRoad } from '../src/world/spline.js';
import { getMap, getWorld } from '../src/maps/maps.js';
import {
  createSimWorld,
  NEUTRAL_INPUT,
  SIM_DT,
  snapshotVehicle,
  stepSim,
} from '../src/index.js';

/** Two segments (as [x1,y1,x2,y2]) intersect strictly between their endpoints. */
function segmentsCross(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): boolean {
  const d = (ax2 - ax1) * (by2 - by1) - (ay2 - ay1) * (bx2 - bx1);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((bx1 - ax1) * (by2 - by1) - (by1 - ay1) * (bx2 - bx1)) / d;
  const u = ((bx1 - ax1) * (ay2 - ay1) - (by1 - ay1) * (ax2 - ax1)) / d;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

describe('fernvale world', () => {
  it('is registered and adapts to a TrackMap', () => {
    expect(getWorld('fernvale')?.name).toBe('fernvale');
    expect(getMap('fernvale').name).toBe('fernvale');
  });

  it('road width varies (village/lake wide, corners/bridge narrow) per the design', () => {
    const w = fernvale();
    const widths = w.roads[0]!.points.map((p) => p.width);
    expect(Math.max(...widths)).toBeGreaterThanOrEqual(9.5); // village/lake
    expect(Math.min(...widths)).toBeLessThanOrEqual(4.5); // bridge
  });

  it('the road centerline does not cross itself (closed simple loop)', () => {
    const samples = sampleRoad(fernvale().roads[0]!, 6);
    const n = samples.length;
    let crossings = 0;
    for (let i = 0; i < n; i++) {
      const a1 = samples[i]!;
      const a2 = samples[(i + 1) % n]!;
      // Only check against segments far enough away in the sequence that
      // they aren't trivially adjacent.
      for (let j = i + 3; j < n - (i === 0 ? 1 : 0); j++) {
        const b1 = samples[j]!;
        const b2 = samples[(j + 1) % n]!;
        if (segmentsCross(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) crossings++;
      }
    }
    expect(crossings).toBe(0);
  });

  it('measures a total perimeter in the ~700-1000m target range', () => {
    const samples = sampleRoad(fernvale().roads[0]!, 12);
    let length = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i]!;
      const b = samples[(i + 1) % samples.length]!;
      length += Math.hypot(b.x - a.x, b.y - a.y);
    }
    expect(length).toBeGreaterThan(650);
    expect(length).toBeLessThan(1100);
  });

  it('spawns the car on the road and lets it drive without instant collision', () => {
    const tm = worldToTrackMap(fernvale());
    const sim = createSimWorld(tm);
    for (let i = 0; i < 180; i++) {
      stepSim(sim, { ...NEUTRAL_INPUT, throttle: 1 }, SIM_DT);
    }
    const s = snapshotVehicle(sim);
    expect(Math.hypot(s.vx, s.vy)).toBeGreaterThan(8);
  });

  it('has ordered gates and a road that stays flat (z = 0 everywhere)', () => {
    const w = fernvale();
    for (const p of w.roads[0]!.points) expect(p.z).toBe(0);
    const tm = worldToTrackMap(w);
    expect(tm.checkpoints).toHaveLength(10);
  });
});
