import type { AssetDescriptor } from '../assets/types.js';
import { buildProp } from './props.js';

/** Real Kenney glTF assets used across Fernvale (see public/assets/CREDITS.md). */
const p = (name: string): AssetDescriptor => ({ kind: 'gltf', url: `/assets/models/props/${name}` });
const b = (name: string): AssetDescriptor => ({ kind: 'gltf', url: `/assets/models/buildings/${name}` });
const v = (name: string): AssetDescriptor => ({ kind: 'gltf', url: `/assets/models/vehicles/${name}` });

/** A handful of Willowbrook's procedural builders, reused for the few
 *  vignette items Kenney's kits didn't have a good fit for (mailbox, lamp
 *  post, hay bale) — mixed alongside real assets in the same pipeline. */
const proc = (kind: Parameters<typeof buildProp>[0]): AssetDescriptor => ({
  kind: 'procedural',
  build: () => buildProp(kind),
});

export const FERNVALE_ASSETS = {
  pineTall: p('tree_pineTallA.glb'),
  pineRound: p('tree_pineRoundC.glb'),
  oak: p('tree_oak.glb'),
  oakFall: p('tree_oak_fall.glb'),
  bushLarge: p('plant_bushLarge.glb'),
  bush: p('plant_bush.glb'),
  flowerRed: p('flower_redA.glb'),
  flowerPurple: p('flower_purpleA.glb'),
  flowerYellow: p('flower_yellowA.glb'),
  grassLarge: p('grass_large.glb'),
  grassLeafs: p('grass_leafs.glb'),
  rockLargeA: p('rock_largeA.glb'),
  rockLargeC: p('rock_largeC.glb'),
  rockSmallA: p('rock_smallA.glb'),
  rockSmallB: p('rock_smallB.glb'),
  stump: p('stump_round.glb'),
  log: p('log.glb'),
  mushroom: p('mushroom_red.glb'),
  mushroomGroup: p('mushroom_redGroup.glb'),
  fence: p('fence_simple.glb'),
  sign: p('sign.glb'),
  cone: p('cone.glb'),
  cropWheat: p('crops_wheatStageB.glb'),
  cropCorn: p('crops_cornStageD.glb'),
  cropDirtRow: p('crops_dirtRow.glb'),
  bench: p('bench.glb'),
  windmill: p('windmill.glb'),
  dock: p('structure-platform-dock.glb'),
  canoe: p('canoe.glb'),
  bridgeNarrow: p('bridge_woodNarrow.glb'),
  towerWall: p('wall.glb'),
  towerRoof: p('roof-point.glb'),
  chimney: p('chimney.glb'),

  houseA: b('building-type-a.glb'),
  houseC: b('building-type-c.glb'),
  houseG: b('building-type-g.glb'),
  houseK: b('building-type-k.glb'),
  houseO: b('building-type-o.glb'),
  houseFence: b('fence.glb'),

  sedan: v('sedan.glb'),
  van: v('van.glb'),
  tractor: v('tractor.glb'),

  mailbox: proc('mailbox'),
  lamp: proc('lamp'),
  hay: proc('hay'),
} as const;
