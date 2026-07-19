import type { Road, RoadPoint } from './types.js';

export interface RoadSample {
  x: number;
  y: number;
  z: number;
  /** Interpolated road half-width. */
  width: number;
  surface: 'paved' | 'dirt';
  /** Unit tangent (travel direction). */
  tx: number;
  ty: number;
}

/** Catmull-Rom basis: position. */
function crPoint(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** Catmull-Rom basis: derivative (unnormalized tangent). */
function crDeriv(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  return (
    0.5 *
    ((-p0 + p2) +
      2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
      3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2)
  );
}

/**
 * Sample a Catmull-Rom road into evenly-parameterized samples.
 * Closed roads wrap neighbor points; open roads clamp endpoints.
 */
export function sampleRoad(road: Road, samplesPerSegment: number): RoadSample[] {
  const pts = road.points;
  const n = pts.length;
  const segs = road.closed ? n : n - 1;
  const at = (i: number): RoadPoint =>
    road.closed ? pts[((i % n) + n) % n]! : pts[Math.min(n - 1, Math.max(0, i))]!;

  const out: RoadSample[] = [];
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let j = 0; j < samplesPerSegment; j++) {
      const t = j / samplesPerSegment;
      const dx = crDeriv(p0.x, p1.x, p2.x, p3.x, t);
      const dy = crDeriv(p0.y, p1.y, p2.y, p3.y, t);
      const len = Math.hypot(dx, dy) || 1;
      out.push({
        x: crPoint(p0.x, p1.x, p2.x, p3.x, t),
        y: crPoint(p0.y, p1.y, p2.y, p3.y, t),
        z: crPoint(p0.z, p1.z, p2.z, p3.z, t),
        width: p1.width + (p2.width - p1.width) * t,
        surface: p1.surface,
        tx: dx / len,
        ty: dy / len,
      });
    }
  }
  return out;
}
