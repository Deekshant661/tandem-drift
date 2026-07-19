/**
 * Pure crossfade math for the three-band engine sound (idle/low/high). Kept
 * separate from AudioManager so it's testable without a real AudioContext.
 */
export interface EngineBandSpec {
  center: number;
  width: number;
}

/** Raised-cosine window: 1 at `center`, smoothly falling to 0 at ±`width`. */
export function bandWeight(norm: number, center: number, width: number): number {
  const d = Math.abs(norm - center);
  if (d >= width) return 0;
  return 0.5 * (1 + Math.cos((d / width) * Math.PI));
}

export const ENGINE_BANDS = {
  idle: { center: 0.0, width: 0.3 },
  low: { center: 0.45, width: 0.45 },
  high: { center: 0.9, width: 0.5 },
} as const satisfies Record<string, EngineBandSpec>;

/** Weight of every band at a given normalized speed (0..1). */
export function engineBandWeights(norm: number): Record<keyof typeof ENGINE_BANDS, number> {
  return {
    idle: bandWeight(norm, ENGINE_BANDS.idle.center, ENGINE_BANDS.idle.width),
    low: bandWeight(norm, ENGINE_BANDS.low.center, ENGINE_BANDS.low.width),
    high: bandWeight(norm, ENGINE_BANDS.high.center, ENGINE_BANDS.high.width),
  };
}
