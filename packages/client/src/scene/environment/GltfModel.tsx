import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { loadAsset } from '../assets/loadAsset.js';
import type { AssetDescriptor } from '../assets/types.js';

/**
 * A single hand-placed real (or procedural) asset instance — for one-off
 * landmarks (windmill, dock, bridge) where GPU instancing isn't worth the
 * complexity. Renders nothing until the model resolves, then mounts once;
 * loadAsset's own cache means repeated uses of the same URL don't re-fetch.
 */
export function GltfModel({
  asset,
  position,
  rotation = 0,
  scale = 1,
  tint,
}: {
  asset: AssetDescriptor;
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  tint?: string;
}): JSX.Element | null {
  const [object, setObject] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAsset(asset).then((resolved) => {
      if (cancelled) return;
      if (tint) {
        resolved.object3D.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
            mat.color.set(tint);
            mesh.material = mat;
          }
        });
      }
      setObject(resolved.object3D);
    });
    return () => {
      cancelled = true;
    };
    // `asset` is a stable descriptor from a fixed landmark list — keying on
    // its identity (not deep-compared) is intentional and matches how it's used.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, tint]);

  if (!object) return null;
  return (
    <primitive object={object} position={position} rotation-y={rotation} scale={scale} />
  );
}
