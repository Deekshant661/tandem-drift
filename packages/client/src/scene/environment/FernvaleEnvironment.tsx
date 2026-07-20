import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { sampleRoad, type WorldMap } from '@tandem/shared';
import { buildHandInstancedGroups } from './handInstancing.js';
import { getFernvaleRepeatedPlacements, FERNVALE_LANDMARKS } from './fernvaleScenery.js';
import { computeSafeLakePlacement } from './lakePlacement.js';
import { GltfModel } from './GltfModel.js';
import { FernvaleLake } from './FernvaleLake.js';
import { WindClock } from './WindClock.js';
import { FernvaleAmbientLife } from './FernvaleAmbientLife.js';

/** Where the "lake reveal" road moment sits — the hint point the safe lake
 *  placement is computed outward from (see lakePlacement.ts). */
const LAKE_HINT = { x: -100, y: -60 };
const LAKE_RADIUS = 26;

/**
 * Fernvale's hand-composed world: real Kenney assets for repeated scenery
 * (GPU-instanced, same pipeline as Willowbrook's procedural scatter) plus
 * individually-placed named landmarks and one simple animated lake.
 * Nothing here is random — every placement traces back to an explicit
 * entry in fernvaleScenery.ts. The lake's position is computed from the
 * real road geometry (not hand-picked) and verified clear of the corridor —
 * a hand-picked lake position is exactly what once let the road drive
 * straight through the water.
 */
export function FernvaleEnvironment({ world }: { world: WorldMap }): JSX.Element | null {
  const [instancedGroup, setInstancedGroup] = useState<THREE.Group | null>(null);

  const lake = useMemo(() => {
    const samples = sampleRoad(world.roads[0]!, 12);
    return computeSafeLakePlacement(samples, LAKE_HINT.x, LAKE_HINT.y, LAKE_RADIUS);
  }, [world]);

  useEffect(() => {
    let cancelled = false;
    buildHandInstancedGroups(getFernvaleRepeatedPlacements()).then((meshes) => {
      if (cancelled) return;
      const g = new THREE.Group();
      g.name = 'fernvale-scenery';
      for (const m of meshes) g.add(m);
      setInstancedGroup(g);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <group>
      {instancedGroup && <primitive object={instancedGroup} />}
      {FERNVALE_LANDMARKS.map((l) => (
        <GltfModel
          key={l.name}
          asset={l.asset}
          position={[l.x, l.height ?? 0, -l.y]}
          rotation={l.rotation}
          scale={l.scale}
          tint={l.tint}
        />
      ))}
      <FernvaleLake x={lake.x} y={lake.y} radius={lake.radius} />
      <WindClock />
      <FernvaleAmbientLife />
    </group>
  );
}
