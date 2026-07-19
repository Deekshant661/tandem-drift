import type { WorldMap } from './types.js';

/**
 * Willowbrook — hand-authored countryside loop (~400×260 m), origin at map
 * center, meters. Route character: village main street (NW) → north meadow →
 * forest S-curves (NE) → lakeside straight and bridge (E) → southern shore →
 * field sweep past windmills (SW) → viewpoint bend (W). Gameplay is flat:
 * all z = 0 in Phase 2 (the format already stores elevation).
 */
export function willowbrook(): WorldMap {
  const paved = (x: number, y: number, width = 8) => ({
    x,
    y,
    z: 0,
    width,
    surface: 'paved' as const,
  });
  return {
    name: 'willowbrook',
    seed: 20260719,
    roads: [
      {
        id: 'main',
        closed: true,
        points: [
          // village approach & main street (NW quadrant)
          paved(-140, 60, 9),
          paved(-100, 95, 9),
          paved(-50, 110, 9),
          // north meadow curve toward the forest
          paved(10, 118, 8),
          paved(70, 105, 7),
          // forest S-curves (NE)
          paved(115, 75, 7),
          paved(95, 40, 7),
          paved(135, 10, 7),
          // lakeside straight heading south (E edge), bridge over the inlet
          paved(150, -40, 8),
          paved(140, -85, 8),
          // southern shore bend
          paved(100, -115, 8),
          paved(40, -125, 8),
          // field sweep (SW) past the windmills
          paved(-30, -118, 9),
          paved(-90, -95, 9),
          // west rise to the viewpoint bend
          paved(-135, -55, 8),
          paved(-150, 0, 8),
        ],
      },
    ],
    spawn: { roadId: 'main', t: 0.02 },
    progress: { mode: 'lap', roadId: 'main', gates: 10 },
    zones: [
      { kind: 'village', x: -95, y: 85, radius: 55 },
      { kind: 'parking', x: -60, y: 70, radius: 18 },
      { kind: 'forest', x: 115, y: 55, radius: 60 },
      { kind: 'lake', x: 105, y: -60, radius: 45 },
      { kind: 'field', x: -55, y: -105, radius: 60 },
      { kind: 'viewpoint', x: -148, y: -30, radius: 20 },
    ],
    landmarks: [
      { kind: 'bridge', x: 146, y: -62, rotation: 1.35 },
      { kind: 'windmill', x: -55, y: -85, rotation: 0.5 },
      { kind: 'windmill', x: -10, y: -100, rotation: 2.1 },
      { kind: 'mountain', x: 0, y: 420, rotation: 0 },
    ],
  };
}
