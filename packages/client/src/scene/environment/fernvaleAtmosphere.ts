/**
 * Continuous atmosphere for Fernvale: every visual property is a smooth
 * function of arc-length position around the loop (t ∈ [0,1)), blended
 * across wide overlapping windows between named character waypoints —
 * never a hard switch between "zones". Same raised-cosine windowing
 * already used for the engine-audio crossfade (packages/client/src/audio/engineCurve.ts).
 */

export interface AtmosphereState {
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientTint: string;
  /** Relative vegetation density multiplier, roughly 0..1. */
  vegetationDensity: number;
  /** Warm/cool ground & foliage color bias. */
  paletteBias: string;
}

interface Waypoint extends AtmosphereState {
  name: string;
  /** Arc-length fraction center, 0..1. */
  center: number;
  /** Half-width of the influence window, 0..1. */
  width: number;
}

const WAYPOINTS: Waypoint[] = [
  {
    name: 'village',
    center: 0.0,
    width: 0.19,
    fogColor: '#d8dce2',
    fogNear: 140,
    fogFar: 600,
    ambientTint: '#fff2df',
    vegetationDensity: 0.5,
    paletteBias: '#ffedd2',
  },
  {
    name: 'farmland',
    center: 0.13,
    width: 0.19,
    fogColor: '#e8dcae',
    fogNear: 150,
    fogFar: 620,
    ambientTint: '#fff0c8',
    vegetationDensity: 0.4,
    paletteBias: '#f0dfa0',
  },
  {
    name: 'forest',
    center: 0.47,
    width: 0.22,
    fogColor: '#8fae86',
    fogNear: 60,
    fogFar: 260,
    ambientTint: '#c9dcc0',
    vegetationDensity: 1.0,
    paletteBias: '#7fae6f',
  },
  {
    name: 'lakeside',
    center: 0.67,
    width: 0.20,
    fogColor: '#cfe3ec',
    fogNear: 160,
    fogFar: 650,
    ambientTint: '#eaf6ff',
    vegetationDensity: 0.35,
    paletteBias: '#bcd8e6',
  },
  {
    name: 'windmillFields',
    center: 0.85,
    width: 0.19,
    fogColor: '#f0dfb0',
    fogNear: 170,
    fogFar: 680,
    ambientTint: '#fff2cf',
    vegetationDensity: 0.45,
    paletteBias: '#f2dca0',
  },
];

/** Shortest circular distance between two fractions on a [0,1) loop. */
function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
}

/** Raised-cosine window: 1 at the center, smoothly falling to 0 at ±width. */
function windowWeight(distance: number, width: number): number {
  if (distance >= width) return 0;
  return 0.5 * (1 + Math.cos((distance / width) * Math.PI));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Weighted blend of hex colors. */
function blendColors(colors: string[], weights: number[]): string {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < colors.length; i++) {
    const [cr, cg, cb] = hexToRgb(colors[i]!);
    r += cr * weights[i]!;
    g += cg * weights[i]!;
    b += cb * weights[i]!;
  }
  return rgbToHex(r, g, b);
}

/**
 * The blended atmosphere at arc-length fraction t. Falls back to an even
 * blend of all waypoints if t lies outside every window (shouldn't happen
 * with the widths above, which fully cover the loop with overlap).
 */
/** Normalized influence (0..1, sums to 1) of every named waypoint at
 *  position t — the raw input the visual blend uses, also useful directly
 *  for the ambient audio crossfade (§7b of the Phase 3 spec). */
export function waypointWeights(t: number): Record<string, number> {
  const wrapped = ((t % 1) + 1) % 1;
  const weights = WAYPOINTS.map((w) => windowWeight(circularDistance(wrapped, w.center), w.width));
  const total = weights.reduce((a, b) => a + b, 0);
  const norm = total > 0 ? weights.map((w) => w / total) : WAYPOINTS.map(() => 1 / WAYPOINTS.length);
  const out: Record<string, number> = {};
  WAYPOINTS.forEach((w, i) => {
    out[w.name] = norm[i]!;
  });
  return out;
}

export function atmosphereAt(t: number): AtmosphereState {
  const wrapped = ((t % 1) + 1) % 1;
  const weights = WAYPOINTS.map((w) => windowWeight(circularDistance(wrapped, w.center), w.width));
  const total = weights.reduce((a, b) => a + b, 0);
  const norm = total > 0 ? weights.map((w) => w / total) : WAYPOINTS.map(() => 1 / WAYPOINTS.length);

  const sum = (pick: (w: Waypoint) => number): number =>
    WAYPOINTS.reduce((acc, w, i) => acc + pick(w) * norm[i]!, 0);

  return {
    fogColor: blendColors(WAYPOINTS.map((w) => w.fogColor), norm),
    fogNear: sum((w) => w.fogNear),
    fogFar: sum((w) => w.fogFar),
    ambientTint: blendColors(WAYPOINTS.map((w) => w.ambientTint), norm),
    vegetationDensity: sum((w) => w.vegetationDensity),
    paletteBias: blendColors(WAYPOINTS.map((w) => w.paletteBias), norm),
  };
}
