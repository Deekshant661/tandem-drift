import { fernvale, mulberry32, sampleRoad, type RoadSample } from '@tandem/shared';
import type { AssetDescriptor } from '../assets/types.js';
import type { HandPlacement } from './handInstancing.js';
import { FERNVALE_ASSETS as A } from './fernvaleAssets.js';

const FERNVALE_SCENERY_SEED = 20260720;
const ROAD_CLEARANCE = 2.5;

let cachedRoadSamples: RoadSample[] | null = null;
function roadSamples(): RoadSample[] {
  if (!cachedRoadSamples) cachedRoadSamples = sampleRoad(fernvale().roads[0]!, 8);
  return cachedRoadSamples;
}

function clearOfRoad(x: number, y: number): boolean {
  for (const s of roadSamples()) {
    if (Math.hypot(x - s.x, y - s.y) < s.width + ROAD_CLEARANCE) return false;
  }
  return true;
}

/** One-off named landmarks — rendered individually (GltfModel), never
 *  instanced. Each exists once, on purpose, for player orientation. */
export interface FernvaleLandmark {
  name: string;
  asset: AssetDescriptor;
  x: number;
  y: number;
  /** Vertical offset (world up), meters — defaults to 0 (ground level). */
  height?: number;
  rotation: number;
  scale: number;
  tint?: string;
}

export const FERNVALE_LANDMARKS: FernvaleLandmark[] = [
  // The distinctive, deliberately oversized windmill — visible from most of
  // the fields stretch, the loop's primary orientation anchor.
  // Position derived from reveal(): 55m ahead of the "sweeper continues"
  // road point, offset off the corridor — visible growing on the horizon
  // as the lakeshore sweeper opens into the fields, not a surprise pop-in.
  { name: 'windmill', asset: A.windmill, x: -147.0, y: 97.4, rotation: 0.4, scale: 1.4 },

  // The red covered bridge, right at the narrow crossing (index 7 on the
  // road). Recolored red via tint — Kenney's bridge model is plain wood.
  { name: 'covered-bridge', asset: A.bridgeNarrow, x: 62, y: -96, rotation: 2.0, scale: 1.3, tint: '#8c2b24' },

  // Lakeside dock + a canoe pulled up beside it. Positions are derived from
  // the real lake placement (see lakePlacement.ts) and verified clear of
  // the road — the previous hand-picked coordinates here were a real bug:
  // placed relative to a lake center that turned out to be 2m from a road
  // point, so the "shore" props ended up sitting on the drivable corridor.
  { name: 'dock', asset: A.dock, x: -111.8, y: -69.3, rotation: 2.24, scale: 1.2 },
  { name: 'canoe', asset: A.canoe, x: -113.5, y: -63.0, rotation: 2.4, scale: 1.0 },

  // Hilltop lookout: a bench + short railing on a rise near the forest
  // exit, looking back across the water — verified clear of both the road
  // and the lake, not just placed nearby.
  { name: 'lookout-bench', asset: A.bench, x: -75, y: -105, rotation: 2.6, scale: 1.1 },
  { name: 'lookout-rail-a', asset: A.fence, x: -79, y: -102, rotation: 1.0, scale: 1 },
  { name: 'lookout-rail-b', asset: A.fence, x: -71, y: -102, rotation: 1.0, scale: 1 },

  // One large, deliberately oversized oak — a hero tree near the village/
  // farmland transition, visible from a long way off.
  // Position derived from reveal(): 35m ahead of the village start, framing
  // the village-to-farmland transition rather than sitting arbitrarily
  // nearby.
  { name: 'hero-oak', asset: A.oak, x: 28.9, y: 87.1, rotation: 0.6, scale: 2.2 },

  // Distant church/clock tower silhouette — composed from modular pieces,
  // hazed toward the sky color for atmospheric perspective. Not reachable;
  // purely a background orientation landmark near the village skyline.
  // Far backdrop position: well beyond the loop (>200m clear of the road),
  // in the direction the long straight actually faces, so it reads as a
  // distant skyline silhouette from that stretch instead of an arbitrary
  // point that happens to be far away. Stacked vertically (a real bug
  // fixed here: these three pieces previously all sat at height 0, so it
  // was two overlapping wall slabs, never actually a tower) — heights are
  // an estimate of the Fantasy Town kit's module size since I can't
  // inspect the loaded mesh's actual bounds myself.
  { name: 'tower-base', asset: A.towerWall, x: -109.8, y: 325.1, height: 0, rotation: 0, scale: 3, tint: '#a9b7c4' },
  { name: 'tower-mid', asset: A.towerWall, x: -109.8, y: 325.1, height: 6, rotation: 0, scale: 3, tint: '#a9b7c4' },
  { name: 'tower-roof', asset: A.towerRoof, x: -109.8, y: 325.1, height: 12, rotation: 0, scale: 3, tint: '#8a97a4' },

  // Second background silhouette, per the layered-skyline design goal —
  // the farmland/tight-corner stretch had no distant landmark at all.
  // Positioned the same way as the tower: far beyond the loop (>190m
  // clear), in the direction that stretch actually faces.
  { name: 'radio-mast', asset: A.radioMast, x: 292.3, y: 110.2, rotation: 0, scale: 1 },

  // Environmental storytelling vignettes — each placed once, on purpose.
  { name: 'parked-tractor', asset: A.tractor, x: 95, y: 65, rotation: 1.6, scale: 1 },
  { name: 'parked-sedan', asset: A.sedan, x: -12, y: 108, rotation: 0.3, scale: 1 },
  { name: 'parked-van', asset: A.van, x: -4, y: 128, rotation: 2.9, scale: 1 },
  { name: 'village-mailbox', asset: A.mailbox, x: 15, y: 112, rotation: 0.5, scale: 1 },
  { name: 'woodpile', asset: A.log, x: -30, y: -95, rotation: 0.2, scale: 1.3 },
  { name: 'lake-picnic-bench', asset: A.bench, x: -108, y: -68, rotation: 3.4, scale: 1 },
];

interface ClusterSpec {
  assets: AssetDescriptor[];
  cx: number;
  cy: number;
  radius: number;
  count: number;
  scaleRange: [number, number];
  tints?: string[];
}

/** Deterministic jittered cluster — hand-picked location and asset mix,
 *  randomized only in rotation/scale/tint so repeats never look identical
 *  (rule: no visible repetition). */
function jitteredCluster(rng: () => number, spec: ClusterSpec): HandPlacement[] {
  const out: HandPlacement[] = [];
  for (let i = 0; i < spec.count; i++) {
    let x = 0;
    let y = 0;
    let placed = false;
    for (let attempt = 0; attempt < 10 && !placed; attempt++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * spec.radius;
      x = spec.cx + Math.cos(a) * d;
      y = spec.cy + Math.sin(a) * d;
      if (clearOfRoad(x, y)) placed = true;
    }
    if (!placed) continue; // this cluster center is too tight against the road; skip rather than force it on
    const asset = spec.assets[Math.floor(rng() * spec.assets.length)]!;
    const [lo, hi] = spec.scaleRange;
    out.push({
      asset,
      x,
      y,
      rotation: rng() * Math.PI * 2,
      scale: lo + rng() * (hi - lo),
      tint: spec.tints ? spec.tints[Math.floor(rng() * spec.tints.length)] : undefined,
    });
  }
  return out;
}

/**
 * Repeated scenery — instanced (buildHandInstancedGroups), density driven
 * by each stretch's character, not scattered uniformly everywhere. Fewer,
 * well-placed clusters with real gaps between them; the lake and open
 * field stretches are deliberately left sparser to preserve negative space.
 */
export function getFernvaleRepeatedPlacements(): HandPlacement[] {
  const rng = mulberry32(FERNVALE_SCENERY_SEED);
  const out: HandPlacement[] = [];
  const add = (spec: ClusterSpec): void => {
    out.push(...jitteredCluster(rng, spec));
  };

  // --- Village (wide, open square feel — light touch) ---
  add({ assets: [A.bushLarge, A.bush], cx: 20, cy: 118, radius: 14, count: 5, scaleRange: [0.8, 1.1] });
  add({ assets: [A.houseA, A.houseC], cx: -40, cy: 128, radius: 10, count: 2, scaleRange: [1, 1] });
  add({ assets: [A.houseG, A.houseK], cx: 40, cy: 130, radius: 12, count: 2, scaleRange: [1, 1] });
  add({ assets: [A.houseO], cx: 5, cy: 140, radius: 4, count: 1, scaleRange: [1, 1] });
  add({ assets: [A.lamp], cx: 0, cy: 118, radius: 20, count: 3, scaleRange: [1, 1] });

  // --- Village → farmland transition ---
  add({ assets: [A.fence], cx: 65, cy: 95, radius: 18, count: 6, scaleRange: [0.95, 1.05] });

  // --- Farmland (open, sparse, crop rows read from a distance) ---
  add({
    assets: [A.cropWheat, A.cropCorn, A.cropDirtRow],
    cx: 95, cy: 55, radius: 22, count: 14, scaleRange: [0.9, 1.1],
  });
  add({ assets: [A.hay], cx: 108, cy: 62, radius: 8, count: 3, scaleRange: [1, 1] });

  // --- Tight 90° corner: flower beds framed by fence lines on both sides
  //     (explicit design ask) — fence positions are the corner's own
  //     tangent/normal at that point (±15m to each side), not a guess.
  add({
    assets: [A.flowerRed, A.flowerPurple, A.flowerYellow],
    cx: 118, cy: 5, radius: 10, count: 16, scaleRange: [0.8, 1.2],
  });
  add({ assets: [A.grassLeafs], cx: 118, cy: 5, radius: 14, count: 10, scaleRange: [0.8, 1.1] });
  add({ assets: [A.fence], cx: 130.0, cy: -0.9, radius: 6, count: 4, scaleRange: [0.95, 1.05] });
  add({ assets: [A.fence], cx: 100.0, cy: 0.9, radius: 6, count: 4, scaleRange: [0.95, 1.05] });

  // --- Narrow bridge approach: modest, a little rocky ---
  add({ assets: [A.rockSmallA, A.rockSmallB], cx: 82, cy: -60, radius: 10, count: 5, scaleRange: [0.8, 1.1] });

  // --- Forest: dense clusters close to the road, gaps of grass between
  //     groves rather than an even wall of trees ---
  add({
    assets: [A.pineTall, A.pineRound, A.oak],
    cx: 20, cy: -105, radius: 18, count: 12, scaleRange: [0.85, 1.15],
  });
  add({
    assets: [A.pineTall, A.pineRound],
    cx: -10, cy: -118, radius: 16, count: 10, scaleRange: [0.85, 1.15],
  });
  add({
    assets: [A.oak, A.oakFall, A.pineRound],
    cx: -40, cy: -100, radius: 16, count: 10, scaleRange: [0.85, 1.2],
  });
  // Hairpin, framed with a dense tree wall on BOTH sides — positions are the
  // hairpin apex's own tangent/normal (±14m), so the turn reads as
  // "squeezing through" trees rather than turning in open ground.
  add({
    assets: [A.pineTall, A.pineRound, A.oak],
    cx: -50.8, cy: -117.7, radius: 8, count: 6, scaleRange: [0.9, 1.15],
  });
  add({
    assets: [A.pineTall, A.pineRound, A.oak],
    cx: -39.2, cy: -92.3, radius: 8, count: 6, scaleRange: [0.9, 1.15],
  });
  add({ assets: [A.stump, A.log, A.mushroomGroup, A.mushroom], cx: 5, cy: -112, radius: 20, count: 8, scaleRange: [0.9, 1.1] });
  add({ assets: [A.rockLargeA, A.rockLargeC], cx: -60, cy: -80, radius: 14, count: 4, scaleRange: [0.9, 1.2] });

  // --- Lake reveal & sweeper: deliberately sparse — the water and sky need
  //     room to read; a few oaks and rocks only ---
  add({ assets: [A.oak], cx: -95, cy: -35, radius: 12, count: 3, scaleRange: [0.9, 1.2] });
  add({ assets: [A.rockLargeA, A.rockSmallA], cx: -120, cy: -15, radius: 16, count: 4, scaleRange: [0.8, 1.2] });
  add({ assets: [A.grassLeafs], cx: -120, cy: 5, radius: 20, count: 6, scaleRange: [0.9, 1.1] });

  // --- Windmill fields: open, warm, sparse — flowers and grass only ---
  add({
    assets: [A.flowerYellow, A.flowerRed],
    cx: -120, cy: 60, radius: 24, count: 12, scaleRange: [0.85, 1.15],
  });
  add({ assets: [A.grassLarge], cx: -105, cy: 90, radius: 18, count: 8, scaleRange: [0.9, 1.1] });
  add({ assets: [A.sign], cx: -118, cy: 42, radius: 2, count: 1, scaleRange: [1, 1] });

  // --- Long straight back to village: light, welcoming ---
  add({ assets: [A.bushLarge, A.bush], cx: -70, cy: 108, radius: 14, count: 5, scaleRange: [0.85, 1.1] });
  add({ assets: [A.cone], cx: 8, cy: 122, radius: 6, count: 2, scaleRange: [1, 1] });

  return out;
}
