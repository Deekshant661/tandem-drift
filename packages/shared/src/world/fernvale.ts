import type { WorldMap } from './types.js';

/**
 * Fernvale — a small (~800m), hand-authored showcase loop. Unlike
 * Willowbrook's scatter-based zones, every foot of this road was placed on
 * purpose: road width and character change continuously through one
 * believable place (village → farmland → forest → lake → fields → village),
 * never as themed zones. Points are listed in a single monotonically
 * increasing angle around the loop center so the closed Catmull-Rom curve
 * can never self-intersect, while radius/width are hand-tuned per point for
 * a deliberate corner sequence:
 *
 *   village (wide) → farmland transition → TIGHT 90° CORNER with flower
 *   beds (narrow) → NARROW BRIDGE approach → red covered bridge (narrowest)
 *   → BLIND CREST illusion into forest → forest winding → forest HAIRPIN →
 *   lake reveal (wide, dock + lookout) → FAST SWEEPING corner along the
 *   lakeshore → windmill fields (wide) → CHICANE → LONG STRAIGHT (sunset
 *   framing) → back to village.
 *
 * zones/landmarks are intentionally empty: Fernvale's atmosphere and
 * landmark placement are entirely client-side (fernvaleAtmosphere.ts,
 * fernvaleScenery.ts) rather than the shared Zone/Landmark vocabulary built
 * for Willowbrook's scatter system, which doesn't fit this map's continuous
 * design. z stays 0 everywhere — the road itself never visually climbs;
 * only the surrounding terrain (client-side heightfield) does.
 */
export function fernvale(): WorldMap {
  const paved = (x: number, y: number, width: number) => ({
    x,
    y,
    z: 0,
    width,
    surface: 'paved' as const,
  });

  return {
    name: 'fernvale',
    seed: 20260720,
    roads: [
      {
        id: 'main',
        closed: true,
        points: [
          paved(0, 120, 10), // village start/finish
          paved(48, 110, 9.5), // village exit curve
          paved(85, 80, 9), // farmland opening
          paved(105, 40, 7), // approach, narrowing for the corner
          paved(115, 0, 5.5), // TIGHT 90° corner apex — flower beds
          paved(100, -45, 5.5), // straight south toward the bridge
          paved(80, -75, 4.5), // narrow bridge approach
          paved(60, -95, 4), // red covered bridge crossing — narrowest
          paved(25, -110, 5.5), // blind-crest illusion into forest
          paved(-15, -115, 6), // forest winding
          paved(-45, -105, 5), // forest hairpin apex
          paved(-70, -90, 6.5), // forest exit
          paved(-100, -60, 9), // lake reveal — dock & lookout
          paved(-125, -20, 9), // fast sweeping right-hander, lakeshore
          paved(-135, 20, 8.5), // sweeper continues
          paved(-130, 60, 9.5), // windmill fields open
          paved(-110, 85, 8), // chicane, first flick
          paved(-90, 100, 9), // chicane, second flick / long straight begins
          paved(-55, 112, 9.5), // long relaxing straight — sunset framing
          paved(-20, 118, 10), // return curve into the village
        ],
      },
    ],
    spawn: { roadId: 'main', t: 0.015 },
    progress: { mode: 'lap', roadId: 'main', gates: 10 },
    zones: [],
    landmarks: [],
  };
}
