import type { RoadSample } from '@tandem/shared';

/**
 * Stage a position "ahead" of a road point along the direction of travel,
 * offset to one side — this is the mechanical tool behind "compose the
 * drive, not the world": a landmark placed `aheadMeters` down the road from
 * a corner, offset `sideMeters` off the corridor, is exactly what comes
 * into view as the car exits that corner, framed the way an environment
 * artist would stage a reveal shot rather than scattered by radius-jitter
 * around a point.
 */
export function reveal(
  samples: RoadSample[],
  hintX: number,
  hintY: number,
  aheadMeters: number,
  sideMeters: number,
): { x: number; y: number } {
  let nearestIndex = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const d = (hintX - s.x) ** 2 + (hintY - s.y) ** 2;
    if (d < nearestDist) {
      nearestDist = d;
      nearestIndex = i;
    }
  }

  // Walk forward along the loop accumulating arc-length until aheadMeters.
  let travelled = 0;
  let i = nearestIndex;
  let cur = samples[i]!;
  while (travelled < aheadMeters) {
    const next = samples[(i + 1) % samples.length]!;
    travelled += Math.hypot(next.x - cur.x, next.y - cur.y);
    i = (i + 1) % samples.length;
    cur = next;
    if (i === nearestIndex) break; // safety: don't loop forever on a tiny road
  }

  const nx = -cur.ty;
  const ny = cur.tx;
  return { x: cur.x + nx * sideMeters, y: cur.y + ny * sideMeters };
}
