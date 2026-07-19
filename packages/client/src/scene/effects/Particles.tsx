import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameClient } from '../../game/client.js';

const MAX = 240;

interface Particle {
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

/**
 * One pooled point cloud drives every gameplay particle effect:
 * - tire smoke while drifting (handbrake at speed),
 * - dust kicked up in hard cornering,
 * - orange sparks on collisions.
 * Effects are modular: each is a spawn rule feeding the shared pool.
 */
export function Particles({ client }: { client: GameClient }): JSX.Element {
  const points = useRef<THREE.Points>(null);
  const pool = useMemo<Particle[]>(
    () =>
      Array.from({ length: MAX }, () => ({
        life: 0, maxLife: 1, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0,
        size: 1, r: 1, g: 1, b: 1,
      })),
    [],
  );
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    return geo;
  }, []);
  const cursor = useRef(0);

  const spawn = (p: Omit<Particle, 'life'>): void => {
    const slot = pool[cursor.current % MAX]!;
    Object.assign(slot, p, { life: p.maxLife });
    cursor.current++;
  };

  useFrame((_, dt) => {
    const pose = client.poseRef.current;
    if (pose) {
      const c = client.controlsRef.current;
      const speed = Math.hypot(pose.vx, pose.vy);
      const fwdX = -Math.sin(pose.angle);
      const fwdZ = -Math.cos(pose.angle);
      // Rear axle position in three-space.
      const rx = pose.x - fwdX * 1.3;
      const rz = -pose.y - fwdZ * 1.3;

      // Drift smoke.
      if (c.handbrake && speed > 4) {
        for (let i = 0; i < 3; i++) {
          spawn({
            maxLife: 0.9, x: rx + (Math.random() - 0.5), y: 0.25, z: rz + (Math.random() - 0.5),
            vx: (Math.random() - 0.5) * 1.5, vy: 1.2 + Math.random(), vz: (Math.random() - 0.5) * 1.5,
            size: 1, r: 0.92, g: 0.92, b: 0.95,
          });
        }
      }
      // Cornering dust.
      if (Math.abs(c.steer) > 0.5 && speed > 12) {
        spawn({
          maxLife: 0.6, x: rx, y: 0.15, z: rz,
          vx: (Math.random() - 0.5) * 2, vy: 0.8, vz: (Math.random() - 0.5) * 2,
          size: 0.8, r: 0.8, g: 0.72, b: 0.55,
        });
      }
      // Collision sparks.
      if (client.fxRef.collision > 0.25) {
        for (let i = 0; i < 6; i++) {
          spawn({
            maxLife: 0.4, x: pose.x + fwdX * 2, y: 0.5, z: -pose.y + fwdZ * 2,
            vx: (Math.random() - 0.5) * 8, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 8,
            size: 0.5, r: 1, g: 0.6, b: 0.15,
          });
        }
      }
    }

    // Integrate + write attributes.
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < MAX; i++) {
      const p = pool[i]!;
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 2 * dt * (p.r === 1 ? 3 : -0.2); // sparks fall; smoke rises
        const fade = Math.max(0, p.life / p.maxLife);
        posAttr.setXYZ(i, p.x, p.y, p.z);
        colAttr.setXYZ(i, p.r * fade, p.g * fade, p.b * fade);
      } else {
        posAttr.setXYZ(i, 0, -100, 0);
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.6}
        vertexColors
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
