import { describe, expect, it } from 'vitest';
import { willowbrook } from '../src/world/willowbrook.js';
import { worldToTrackMap } from '../src/world/generate.js';
import { getMap, getWorld } from '../src/maps/maps.js';
import {
  createSimWorld,
  NEUTRAL_INPUT,
  SIM_DT,
  snapshotVehicle,
  stepSim,
} from '../src/index.js';

describe('willowbrook world', () => {
  it('is registered and adapts to a TrackMap', () => {
    expect(getWorld('willowbrook')?.name).toBe('willowbrook');
    expect(getMap('willowbrook').name).toBe('willowbrook');
    expect(getWorld('track01')).toBeNull(); // legacy maps have no 3D world
  });

  it('has one closed main road with sensible geometry', () => {
    const w = willowbrook();
    const main = w.roads[0]!;
    expect(main.closed).toBe(true);
    expect(main.points.length).toBeGreaterThanOrEqual(16);
    for (const p of main.points) {
      expect(p.width).toBeGreaterThanOrEqual(5);
      expect(p.width).toBeLessThanOrEqual(12);
      expect(p.z).toBe(0);
    }
  });

  it('spawns the car on the road and lets it drive without instant collision', () => {
    const tm = worldToTrackMap(willowbrook());
    const sim = createSimWorld(tm);
    for (let i = 0; i < 180; i++) {
      stepSim(sim, { ...NEUTRAL_INPUT, throttle: 1 }, SIM_DT);
    }
    const s = snapshotVehicle(sim);
    // 3 s of full throttle from spawn must reach real speed — if the spawn
    // faced a wall we'd be slow or stuck.
    expect(Math.hypot(s.vx, s.vy)).toBeGreaterThan(8);
  });

  it('zones and landmarks cover the required areas', () => {
    const w = willowbrook();
    const kinds = new Set(w.zones.map((z) => z.kind));
    for (const k of ['village', 'forest', 'lake', 'field', 'parking'] as const) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(w.landmarks.filter((l) => l.kind === 'windmill').length).toBeGreaterThanOrEqual(2);
    expect(w.landmarks.some((l) => l.kind === 'bridge')).toBe(true);
  });
});
