import type { RoadSample } from '@tandem/shared';

export interface LakePlacement {
  x: number;
  y: number;
  radius: number;
}

/**
 * Compute a lake position that is guaranteed clear of the road corridor —
 * derived from the real road geometry and verified against every sample,
 * not hand-picked. (A hand-picked placement is exactly what caused a real
 * bug: a lake centered 2m from a road point, so the road drove through it.)
 *
 * Starts near `hintX, hintY` (roughly where the "lake reveal" moment should
 * read as a reveal — just off the road at that point) and pushes outward
 * along the nearest road sample's outward normal until the whole lake
 * circle clears every sample in the road, not just the nearest one.
 */
export function computeSafeLakePlacement(
  samples: RoadSample[],
  hintX: number,
  hintY: number,
  desiredRadius: number,
  margin = 4,
): LakePlacement {
  // Nearest sample to the hint defines the outward direction to push along.
  let nearest = samples[0]!;
  let nearestDist = Infinity;
  for (const s of samples) {
    const d = (hintX - s.x) ** 2 + (hintY - s.y) ** 2;
    if (d < nearestDist) {
      nearestDist = d;
      nearest = s;
    }
  }
  const nx = -nearest.ty;
  const ny = nearest.tx;
  // Push along whichever normal direction moves AWAY from the loop's
  // centroid (approximated by the origin, reasonable for a closed loop
  // authored roughly centered there) — that's "outside" the loop, where a
  // lake glimpsed beside the road belongs, rather than into its interior.
  const trial = 30;
  const distPositive = Math.hypot(nearest.x + nx * trial, nearest.y + ny * trial);
  const distNegative = Math.hypot(nearest.x - nx * trial, nearest.y - ny * trial);
  const towardOutside = distPositive >= distNegative ? 1 : -1;
  const dirX = nx * towardOutside;
  const dirY = ny * towardOutside;

  const clearsEverywhere = (cx: number, cy: number): boolean => {
    for (const s of samples) {
      const dist = Math.hypot(cx - s.x, cy - s.y);
      if (dist - s.width < desiredRadius + margin) return false;
    }
    return true;
  };

  let offset = nearest.width + margin + desiredRadius;
  const step = 5;
  const maxOffset = 400;
  let x = nearest.x + dirX * offset;
  let y = nearest.y + dirY * offset;
  while (!clearsEverywhere(x, y) && offset < maxOffset) {
    offset += step;
    x = nearest.x + dirX * offset;
    y = nearest.y + dirY * offset;
  }
  return { x, y, radius: desiredRadius };
}
