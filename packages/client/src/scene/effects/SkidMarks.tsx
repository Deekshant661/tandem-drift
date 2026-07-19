import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameClient } from '../../game/client.js';

const MAX_SEGMENTS = 400;

/**
 * Fading rubber marks laid down by the rear wheels while drifting.
 * A ring buffer of quad segments in one geometry — constant draw cost.
 */
export function SkidMarks({ client }: { client: GameClient }): JSX.Element {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(MAX_SEGMENTS * 6 * 3), 3),
    );
    geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(MAX_SEGMENTS * 6), 1));
    return geo;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {},
        vertexShader: `attribute float alpha; varying float vA;
          void main(){ vA = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying float vA;
          void main(){ gl_FragColor = vec4(0.12, 0.12, 0.14, vA * 0.55); }`,
      }),
    [],
  );
  const cursor = useRef(0);
  const lastPos = useRef<{ lx: number; lz: number; rx: number; rz: number } | null>(null);
  const alphas = useRef(new Float32Array(MAX_SEGMENTS));

  useFrame((_, dt) => {
    const pose = client.poseRef.current;
    const c = client.controlsRef.current;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const aAttr = geometry.getAttribute('alpha') as THREE.BufferAttribute;

    if (pose) {
      const speed = Math.hypot(pose.vx, pose.vy);
      const drifting = c.handbrake && speed > 4;
      const fwdX = -Math.sin(pose.angle);
      const fwdZ = -Math.cos(pose.angle);
      const sideX = -fwdZ;
      const sideZ = fwdX;
      // Rear wheels in three-space.
      const lx = pose.x - fwdX * 1.25 - sideX * 0.82;
      const lz = -pose.y - fwdZ * 1.25 - sideZ * 0.82;
      const rx = pose.x - fwdX * 1.25 + sideX * 0.82;
      const rz = -pose.y - fwdZ * 1.25 + sideZ * 0.82;

      if (drifting && lastPos.current) {
        const prev = lastPos.current;
        const seg = cursor.current % MAX_SEGMENTS;
        const base = seg * 6;
        const W = 0.14;
        const put = (
          v: number,
          x1: number, z1: number, x2: number, z2: number, x3: number, z3: number,
        ): void => {
          posAttr.setXYZ(base + v, x1, 0.02, z1);
          posAttr.setXYZ(base + v + 1, x2, 0.02, z2);
          posAttr.setXYZ(base + v + 2, x3, 0.02, z3);
        };
        // Two thin triangles per wheel pair segment (left wheel strip and
        // right wheel strip share the segment slot alternately for economy).
        put(0, prev.lx - W, prev.lz, prev.lx + W, prev.lz, lx - W, lz);
        put(3, prev.rx - W, prev.rz, prev.rx + W, prev.rz, rx - W, rz);
        alphas.current[seg] = 1;
        cursor.current++;
      }
      lastPos.current = drifting ? { lx, lz, rx, rz } : null;
    }

    // Fade all segments.
    let dirty = false;
    for (let s = 0; s < MAX_SEGMENTS; s++) {
      const a = alphas.current[s]!;
      if (a > 0) {
        const next = Math.max(0, a - dt * 0.12);
        alphas.current[s] = next;
        for (let v = 0; v < 6; v++) aAttr.setX(s * 6 + v, next);
        dirty = true;
      }
    }
    if (dirty) {
      posAttr.needsUpdate = true;
      aAttr.needsUpdate = true;
    }
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
