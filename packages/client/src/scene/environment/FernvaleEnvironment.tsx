import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { buildHandInstancedGroups } from './handInstancing.js';
import { getFernvaleRepeatedPlacements, FERNVALE_LANDMARKS } from './fernvaleScenery.js';
import { GltfModel } from './GltfModel.js';
import { FernvaleLake } from './FernvaleLake.js';
import { WindClock } from './WindClock.js';
import { FernvaleAmbientLife } from './FernvaleAmbientLife.js';

/**
 * Fernvale's hand-composed world: real Kenney assets for repeated scenery
 * (GPU-instanced, same pipeline as Willowbrook's procedural scatter) plus
 * individually-placed named landmarks and one simple animated lake.
 * Nothing here is random — every placement traces back to an explicit
 * entry in fernvaleScenery.ts.
 */
export function FernvaleEnvironment(): JSX.Element | null {
  const [instancedGroup, setInstancedGroup] = useState<THREE.Group | null>(null);

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
          position={[l.x, 0, -l.y]}
          rotation={l.rotation}
          scale={l.scale}
          tint={l.tint}
        />
      ))}
      <FernvaleLake x={-100} y={-58} radius={38} />
      <WindClock />
      <FernvaleAmbientLife />
    </group>
  );
}
