import { useMemo } from 'react';
import * as THREE from 'three';
import { mulberry32 } from '@tandem/shared';

/**
 * Flat grass disc with subtle per-vertex color variation (patches of richer
 * and softer green) so it doesn't read as one flat saturated color. Built
 * once from the world seed — no per-frame cost.
 */
export function Ground({ seed }: { seed: number }): JSX.Element {
  const geometry = useMemo(() => {
    const geo = new THREE.CircleGeometry(750, 64, 0, Math.PI * 2);
    const rng = mulberry32(seed ^ 0x6a55);
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color('#6fa651');
    const rich = new THREE.Color('#588a41');
    const dry = new THREE.Color('#8fae5a');
    for (let i = 0; i < pos.count; i++) {
      const t = rng();
      const c = t < 0.5 ? base.clone().lerp(rich, t * 2) : base.clone().lerp(dry, (t - 0.5) * 2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [seed]);

  return (
    <mesh
      geometry={geometry}
      rotation-x={-Math.PI / 2}
      position-y={-0.05}
      receiveShadow
    >
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}
