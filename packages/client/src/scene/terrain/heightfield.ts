import { mulberry32 } from '@tandem/shared';

/** A point along the road corridor that must stay visually flat. */
export interface RoadFlattenPoint {
  x: number;
  y: number;
  width: number;
}

export type TerrainFeature =
  | { kind: 'hill'; x: number; y: number; radius: number; height: number }
  | { kind: 'valley'; x: number; y: number; radius: number; depth: number }
  | {
      kind: 'cliff';
      /** Escarpment line; terrain drops moving from side A to side B. */
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      drop: number;
      /** Horizontal distance over which the drop blends in, meters. */
      blend: number;
    };

/** Extra distance beyond the road edge before terrain is allowed to rise —
 *  the "no wall of dirt at the tires" guarantee. */
const ROAD_MARGIN = 8;
/** Distance over which flatness blends into full terrain height. Generous
 *  on purpose: hills/cliffs authored at 17-26m tall need real horizontal
 *  room to ramp up in, or they read as a steep wall right next to the car
 *  instead of distant depth (a 20m rise over ~20m was exactly that bug). */
const FALLOFF_DISTANCE = 45;

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** How "allowed to have terrain" a point is: 0 on/near the road, 1 well beyond it. */
function roadFactor(x: number, y: number, road: RoadFlattenPoint[]): number {
  let minGap = Infinity;
  for (const p of road) {
    const d = Math.hypot(x - p.x, y - p.y) - p.width;
    if (d < minGap) minGap = d;
  }
  return smoothstep((minGap - ROAD_MARGIN) / FALLOFF_DISTANCE);
}

function featureHeight(x: number, y: number, feature: TerrainFeature): number {
  switch (feature.kind) {
    case 'hill': {
      const d = Math.hypot(x - feature.x, y - feature.y);
      return feature.height * smoothstep(1 - d / feature.radius);
    }
    case 'valley': {
      const d = Math.hypot(x - feature.x, y - feature.y);
      return -feature.depth * smoothstep(1 - d / feature.radius);
    }
    case 'cliff': {
      // Signed perpendicular distance from the escarpment LINE, plus the
      // position projected ALONG it — a cliff must stay a local feature
      // near its authored segment, not an infinite line that drops the
      // entire map on one side of it (a real bug this caught: an unbounded
      // line was silently applying a full-height drop everywhere far from
      // where the feature was ever meant to be visible).
      const dx = feature.x2 - feature.x1;
      const dy = feature.y2 - feature.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const ax = dx / len;
      const ay = dy / len;
      const signed = (x - feature.x1) * nx + (y - feature.y1) * ny;
      const along = (x - feature.x1) * ax + (y - feature.y1) * ay;
      // signed > 0 is the high side (no drop yet); signed < 0 is fully
      // dropped; the blend band straddles signed = 0.
      const dropFactor = smoothstep(0.5 - signed / feature.blend);
      // Taper to 0 beyond the segment's own ends (using the same blend
      // width), so the cliff reads as one local escarpment, not a wall
      // across the whole world.
      const endFactor = smoothstep(along / feature.blend) * smoothstep((len - along) / feature.blend);
      return -feature.drop * dropFactor * endFactor;
    }
  }
}

/** Cheap deterministic value noise: hashed grid corners, bilinear blend. */
function valueNoise(x: number, y: number, seed: number, cellSize: number): number {
  const gx = Math.floor(x / cellSize);
  const gy = Math.floor(y / cellSize);
  const fx = x / cellSize - gx;
  const fy = y / cellSize - gy;
  const corner = (cx: number, cy: number): number => mulberry32(seed ^ ((cx * 374761393) ^ (cy * 668265263)))();
  const a = corner(gx, gy);
  const b = corner(gx + 1, gy);
  const c = corner(gx, gy + 1);
  const d = corner(gx + 1, gy + 1);
  const top = a + (b - a) * smoothstep(fx);
  const bottom = c + (d - c) * smoothstep(fx);
  return top + (bottom - top) * smoothstep(fy);
}

/**
 * Visual-only terrain height at (x, y). Exactly 0 within the road corridor
 * (+ margin), smoothly blending out to authored hills/valley/cliff plus
 * light noise beyond it. Gameplay physics never reads this — it exists
 * purely so Fernvale's ground mesh has depth without ever visually
 * contradicting the flat physics near the road.
 */
export function terrainHeight(
  x: number,
  y: number,
  road: RoadFlattenPoint[],
  features: TerrainFeature[],
  seed: number,
): number {
  const factor = roadFactor(x, y, road);
  if (factor <= 0) return 0;
  let h = 0;
  for (const f of features) h += featureHeight(x, y, f);
  h += valueNoise(x, y, seed, 18) * 1.2 - 0.6; // small +-0.6m micro-variation
  return h * factor;
}
