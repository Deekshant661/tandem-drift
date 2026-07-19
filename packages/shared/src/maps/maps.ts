import { ARENA_HEIGHT, ARENA_WIDTH } from '../constants.js';
import type { TrackMap, WallSegment } from './types.js';

/** Chain a closed polygon of points into wall segments. */
function ring(points: Array<[number, number]>): WallSegment[] {
  return points.map(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length]!;
    return { x1, y1, x2, y2 };
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
    checkpoints: [
      { x: midX, y: 0, radius: gateRadius }, // start/finish, right straight
      { x: midX - 8, y: midY - 5, radius: gateRadius }, // top-right corner
      { x: 0, y: midY, radius: gateRadius }, // top straight
      { x: -midX + 8, y: midY - 5, radius: gateRadius }, // top-left corner
      { x: -midX, y: 0, radius: gateRadius }, // left straight
      { x: -midX + 8, y: -midY + 5, radius: gateRadius }, // bottom-left corner
      { x: 0, y: -midY, radius: gateRadius }, // bottom straight
      { x: midX - 8, y: -midY + 5, radius: gateRadius }, // bottom-right corner
    ],
  };
}
