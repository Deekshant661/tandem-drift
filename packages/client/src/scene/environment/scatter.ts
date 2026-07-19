import { mulberry32, sampleRoad, type WorldMap, type Zone } from '@tandem/shared';

export type PropKind =
  | 'pine'
  | 'oak'
  | 'bush'
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
    ['bush', 10],
  ],
  forest: [
    ['pine', 46],
    ['oak', 22],
    ['bush', 24],
    ['rock', 8],
    ['grass', 24],
  ],
  lake: [
    ['rock', 10],
    ['grass', 16],
    ['oak', 6],
    ['bush', 8],
  ],
  field: [
    ['flower', 70],
    ['grass', 44],
    ['hay', 7],
    ['fence', 10],
    ['bush', 6],
  ],
  tunnel: [['rock', 12]],
  viewpoint: [
    ['rock', 6],
    ['bench', 2],
    ['flower', 12],
    ['bush', 5],
  ],
  parking: [['cone', 6]],
};

/**
 * Kinds that read better as loose clumps than as an even sprinkle: forest
 * trees/shrubs cluster into groves with grassy gaps between them, and field
 * flowers cluster into patches rather than a uniform meadow dusting.
 */
const CLUSTERED: ReadonlySet<string> = new Set([
  'forest:pine',
  'forest:oak',
  'forest:bush',
  'field:flower',
  'lake:bush',
]);

/** Extra wilderness sprinkled everywhere outside zones. */
const WILD: Array<[PropKind, number]> = [
  ['pine', 60],
  ['oak', 40],
  ['bush', 20],
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

  /** Groves/patches: pick cluster centers within the zone, then scatter
   *  tightly around each so vegetation reads as intentional clumps. */
  const scatterClustered = (
    kind: PropKind,
    count: number,
    zone: Zone,
    clusterCount: number,
    clusterRadiusFactor: number,
  ): void => {
    const centers = Array.from({ length: clusterCount }, () => {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * zone.radius * 0.65;
      return { x: zone.x + Math.cos(a) * d, y: zone.y + Math.sin(a) * d };
    });
    for (let i = 0; i < count; i++) {
      const c = centers[i % centers.length]!;
      tryPlace(kind, c.x, c.y, zone.radius * clusterRadiusFactor, zone.kind);
    }
  };

  for (const zone of world.zones) {
    for (const [kind, count] of ZONE_RECIPES[zone.kind]) {
      if (CLUSTERED.has(`${zone.kind}:${kind}`)) {
        scatterClustered(kind, count, zone, 6, 0.28);
      } else {
        for (let i = 0; i < count; i++) tryPlace(kind, zone.x, zone.y, zone.radius, zone.kind);
      }
    }
  }
  for (const [kind, count] of WILD) {
    for (let i = 0; i < count; i++) tryPlace(kind, 0, 0, WILD_EXTENT, 'wild');
  }
  return out;
}
