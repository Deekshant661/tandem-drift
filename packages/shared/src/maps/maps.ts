import { ARENA_HEIGHT, ARENA_WIDTH } from '../constants.js';
import type { Checkpoint, TrackMap, WallSegment } from './types.js';
import type { WorldMap } from '../world/types.js';
import { worldToTrackMap } from '../world/generate.js';
import { willowbrook } from '../world/willowbrook.js';
import { fernvale } from '../world/fernvale.js';

/** Chain a closed polygon of points into wall segments. */
function ring(points: Array<[number, number]>): WallSegment[] {
  return points.map(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length]!;
    return { x1, y1, x2, y2 };
  });
}

/**
 * Derive each gate's recovery-facing angle from the direction to the next
 * gate in the loop — same atan2(-dx, dy) convention as worldToTrackMap.
 */
function chainCheckpoints(gates: Array<{ x: number; y: number; radius: number }>): Checkpoint[] {
  return gates.map((g, i) => {
    const next = gates[(i + 1) % gates.length]!;
    const dx = next.x - g.x;
    const dy = next.y - g.y;
    const len = Math.hypot(dx, dy) || 1;
    return { ...g, angle: Math.atan2(-dx / len, dy / len) };
  });
}

/** Axis-aligned rectangle with chamfered corners, as a point ring. */
function chamferedRect(hw: number, hh: number, chamfer: number): Array<[number, number]> {
  return [
    [-hw + chamfer, -hh],
    [hw - chamfer, -hh],
    [hw, -hh + chamfer],
    [hw, hh - chamfer],
    [hw - chamfer, hh],
    [-hw + chamfer, hh],
    [-hw, hh - chamfer],
    [-hw, -hh + chamfer],
  ];
}

/**
 * Track 02 "The Squeeze": same circuit shape as track01 but with a much
 * narrower corridor (~13 m) and sharper chamfers — a communication stress test.
 */
export function track02(): TrackMap {
  const outerHw = ARENA_WIDTH / 2;
  const outerHh = ARENA_HEIGHT / 2;
  const innerHw = 46;
  const innerHh = 26;
  const midX = (outerHw + innerHw) / 2; // 53
  const midY = (outerHh + innerHh) / 2; // 33
  const gateRadius = 7;

  return {
    name: 'track02',
    spawn: { x: midX, y: -12, angle: 0 },
    walls: [...ring(chamferedRect(outerHw, outerHh, 10)), ...ring(chamferedRect(innerHw, innerHh, 6))],
    checkpoints: chainCheckpoints([
      { x: midX, y: 0, radius: gateRadius },
      { x: midX - 5, y: midY - 4, radius: gateRadius },
      { x: 0, y: midY, radius: gateRadius },
      { x: -midX + 5, y: midY - 4, radius: gateRadius },
      { x: -midX, y: 0, radius: gateRadius },
      { x: -midX + 5, y: -midY + 4, radius: gateRadius },
      { x: 0, y: -midY, radius: gateRadius },
      { x: midX - 5, y: -midY + 4, radius: gateRadius },
    ]),
  };
}

/** Playable maps by name; arena is test-only and deliberately not listed. */
export const PLAYABLE_MAPS: Record<string, () => TrackMap> = {
  track01,
  track02,
  willowbrook: () => worldToTrackMap(willowbrook()),
  fernvale: () => worldToTrackMap(fernvale()),
};

export const DEFAULT_MAP = 'willowbrook';

/** 3D world description for a map, or null for legacy 2D-only maps. */
export function getWorld(name: string): WorldMap | null {
  if (name === 'willowbrook') return willowbrook();
  if (name === 'fernvale') return fernvale();
  return null;
}

/** Resolve a playable map by name, falling back to the default. */
export function getMap(name: string | undefined): TrackMap {
  return (PLAYABLE_MAPS[name ?? DEFAULT_MAP] ?? track01)();
}

/** Plain walled rectangle, no checkpoints. Used for tests and free drive. */
export function arenaMap(): TrackMap {
  return {
    name: 'arena',
    spawn: { x: 0, y: 0, angle: 0 },
    walls: ring([
      [-ARENA_WIDTH / 2, -ARENA_HEIGHT / 2],
      [ARENA_WIDTH / 2, -ARENA_HEIGHT / 2],
      [ARENA_WIDTH / 2, ARENA_HEIGHT / 2],
      [-ARENA_WIDTH / 2, ARENA_HEIGHT / 2],
    ]),
    checkpoints: [],
  };
}

/**
 * Track 01 "First Date": a chamfered-rectangle circuit. The drivable corridor
 * is the ring between the outer and inner walls (~21 m wide), raced
 * counter-clockwise. Checkpoint 0 sits mid-corridor on the right straight and
 * doubles as start/finish.
 */
export function track01(): TrackMap {
  const outerHw = ARENA_WIDTH / 2; // 60
  const outerHh = ARENA_HEIGHT / 2; // 40
  const innerHw = 39;
  const innerHh = 19;
  const midX = (outerHw + innerHw) / 2; // 49.5
  const midY = (outerHh + innerHh) / 2; // 29.5
  const gateRadius = 11;

  return {
    name: 'track01',
    // Start on the right straight, facing "up" the corridor (counter-clockwise).
    spawn: { x: midX, y: -12, angle: 0 },
    walls: [...ring(chamferedRect(outerHw, outerHh, 14)), ...ring(chamferedRect(innerHw, innerHh, 8))],
    checkpoints: chainCheckpoints([
      { x: midX, y: 0, radius: gateRadius }, // start/finish, right straight
      { x: midX - 8, y: midY - 5, radius: gateRadius }, // top-right corner
      { x: 0, y: midY, radius: gateRadius }, // top straight
      { x: -midX + 8, y: midY - 5, radius: gateRadius }, // top-left corner
      { x: -midX, y: 0, radius: gateRadius }, // left straight
      { x: -midX + 8, y: -midY + 5, radius: gateRadius }, // bottom-left corner
      { x: 0, y: -midY, radius: gateRadius }, // bottom straight
      { x: midX - 8, y: -midY + 5, radius: gateRadius }, // bottom-right corner
    ]),
  };
}
