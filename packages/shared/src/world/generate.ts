import type { Checkpoint, TrackMap, WallSegment } from '../maps/types.js';
import type { WorldMap } from './types.js';
import { sampleRoad, type RoadSample } from './spline.js';

/** Left/right road-edge points of a sample. Normal = (-ty, tx). */
function edges(s: RoadSample): { lx: number; ly: number; rx: number; ry: number } {
  const nx = -s.ty;
  const ny = s.tx;
  return {
    lx: s.x + nx * s.width,
    ly: s.y + ny * s.width,
    rx: s.x - nx * s.width,
    ry: s.y - ny * s.width,
  };
}

/** Two wall polylines hugging both road edges (physics = what you see). */
export function wallsFromSamples(samples: RoadSample[], closed: boolean): WallSegment[] {
  const walls: WallSegment[] = [];
  const last = closed ? samples.length : samples.length - 1;
  for (let i = 0; i < last; i++) {
    const a = edges(samples[i]!);
    const b = edges(samples[(i + 1) % samples.length]!);
    walls.push({ x1: a.lx, y1: a.ly, x2: b.lx, y2: b.ly });
    walls.push({ x1: a.rx, y1: a.ry, x2: b.rx, y2: b.ry });
  }
  return walls;
}

/** Evenly spaced centerline gates; radius scales with local road width. */
export function gatesFromSamples(samples: RoadSample[], count: number): Checkpoint[] {
  const gates: Checkpoint[] = [];
  for (let g = 0; g < count; g++) {
    const s = samples[Math.floor((g / count) * samples.length)]!;
    gates.push({ x: s.x, y: s.y, radius: s.width * 1.5 });
  }
  return gates;
}

/**
 * Adapter: the entire server/physics side consumes a WorldMap through this —
 * the untouched planck sim gets walls, spawn, and checkpoints exactly as
 * before, generated from the road network.
 */
export function worldToTrackMap(world: WorldMap, samplesPerSegment = 8): TrackMap {
  const road = world.roads.find((r) => r.id === world.progress.roadId);
  if (!road) throw new Error(`progress road '${world.progress.roadId}' not found`);
  const samples = sampleRoad(road, samplesPerSegment);
  const spawnSample =
    samples[Math.floor(world.spawn.t * samples.length) % samples.length]!;
  return {
    name: world.name,
    // Vehicle forward is local +y; rotated by angle a it is (-sin a, cos a).
    // We need that to equal the tangent (tx, ty) → a = atan2(-tx, ty).
    spawn: {
      x: spawnSample.x,
      y: spawnSample.y,
      angle: Math.atan2(-spawnSample.tx, spawnSample.ty),
    },
    walls: wallsFromSamples(samples, road.closed),
    checkpoints: gatesFromSamples(samples, world.progress.gates),
  };
}
