import type { TerrainFeature } from './heightfield.js';

/**
 * Hand-authored terrain features beyond Fernvale's road corridor — visual
 * depth only (gameplay stays flat). Placed to support specific moments:
 * a hill rising behind the village, a gentle valley on the farmland
 * approach, a dramatic cliff along the outside of the lakeside sweeper,
 * and a rise behind the windmill fields so the windmill reads against the
 * sky from a distance.
 */
export const FERNVALE_TERRAIN_FEATURES: TerrainFeature[] = [
  { kind: 'hill', x: 0, y: 210, radius: 95, height: 20 },
  { kind: 'valley', x: -60, y: 165, radius: 55, depth: 7 },
  { kind: 'hill', x: 170, y: -70, radius: 75, height: 26 },
  {
    kind: 'cliff',
    x1: -155,
    y1: -50,
    x2: -168,
    y2: 35,
    drop: 22,
    blend: 20,
  },
  { kind: 'hill', x: -175, y: 85, radius: 65, height: 17 },
];
