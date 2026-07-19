import { mulberry32, sampleRoad, type WorldMap, type Zone } from '@tandem/shared';

export type PropKind =
  | 'pine'
  | 'oak'
  | 'flower'
  | 'grass'
  | 'rock'
  | 'house'
  | 'fence'
  | 'lamp'
  | 'hay'
  | 'bench'
  | 'mailbox'
  | 'crate'
  | 'cone';

export interface Placement {
  kind: PropKind;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  /** Zone the placement belongs to (streaming-ready grouping). */
  zone: Zone['kind'] | 'wild';
}

/** What grows/stands in each zone, with per-item counts scaled by zone area. */
const ZONE_RECIPES: Record<Zone['kind'], Array<[PropKind, number]>> = {
  village: [
    ['house', 10],
    ['lamp', 8],
    ['fence', 14],
    ['bench', 4],
    ['mailbox', 4],
    ['crate', 5],
  ],
  forest: [
    ['pine', 46],
    ['oak', 22],
    ['rock', 8],
    ['grass', 30],
  ],
  lake: [
    ['rock', 10],
    ['grass', 16],
    ['oak', 6],
  ],
  field: [
    ['flower', 70],
    ['grass', 50],
    ['hay', 7],
    ['fence', 10],
  ],
  tunnel: [['rock', 12]],
  viewpoint: [
    ['rock', 6],
    ['bench', 2],
    ['flower', 12],
  ],
  parking: [['cone', 6]],
};

/** Extra wilderness sprinkled everywhere outside zones. */
const WILD: Array<[PropKind, number]> = [
  ['pine', 60],
  ['oak', 40],
  ['flower', 80],
  ['grass', 90],
  ['rock', 20],
];

const WILD_EXTENT = 320;

/**
 * Deterministically scatter scenery from the world seed. Placements never
 * land on the road (distance to every road sample > local width + margin),
 * so physics and visuals can't disagree about drivable space.
 */
export function scatterWorld(world: WorldMap): Placement[] {
  const rng = mulberry32(world.seed);
  const roadSamples = world.roads.flatMap((r) => sampleRoad(r, 6));
  const lake = world.zones.find((z) => z.kind === 'lake');

  const clearOfRoad = (x: number, y: number, margin: number): boolean => {
    for (const s of roadSamples) {
      const dx = x - s.x;
      const dy = y - s.y;
      if (dx * dx + dy * dy < (s.width + margin) ** 2) return false;
    }
    return true;
  };
  const inLakeWater = (x: number, y: number): boolean =>
    lake !== undefined && Math.hypot(x - lake.x, y - lake.y) < lake.radius * 0.75;

  const out: Placement[] = [];
  const tryPlace = (
    kind: PropKind,
    cx: number,
    cy: number,
    radius: number,
    zone: Placement['zone'],
  ): void => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * radius;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const margin = kind === 'house' ? 7 : kind === 'hay' || kind === 'rock' ? 3 : 1.5;
      if (!clearOfRoad(x, y, margin)) continue;
      if (inLakeWater(x, y) && kind !== 'rock') continue;
      out.push({ kind, x, y, rotation: rng() * Math.PI * 2, scale: 0.8 + rng() * 0.5, zone });
      return;
    }
  };

  for (const zone of world.zones) {
    for (const [kind, count] of ZONE_RECIPES[zone.kind]) {
      for (let i = 0; i < count; i++) tryPlace(kind, zone.x, zone.y, zone.radius, zone.kind);
    }
  }
  for (const [kind, count] of WILD) {
    for (let i = 0; i < count; i++) tryPlace(kind, 0, 0, WILD_EXTENT, 'wild');
  }
  return out;
}
