import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameClient } from '../game/client.js';

/**
 * Spring-damped chase camera with velocity look-ahead and speed-scaled FOV.
 * Sim forward for angle a is (-sin a, cos a) in sim-(x,y); with the scene
 * mapping (x, y) → (x, -y) that becomes three-forward (-sin a, -cos a).
 */
export function ChaseCamera({ client }: { client: GameClient }): JSX.Element | null {
  const cur = useRef(new THREE.Vector3(0, 30, 40));
  const look = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  const tmpAhead = useRef(new THREE.Vector3());
  const lookBack = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'KeyC') lookBack.current = true;
    };
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'KeyC') lookBack.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame(({ camera }, dt) => {
    const p = client.poseRef.current;
    if (!p) return;
    const speed = Math.hypot(p.vx, p.vy);
    // Hold C to look back: camera flips to the front, looking rearward.
    const dir = lookBack.current ? -1 : 1;
    const fwdX = -Math.sin(p.angle) * dir;
    const fwdZ = -Math.cos(p.angle) * dir;

    const back = 9 + Math.min(4, speed * 0.12);
    tmpTarget.current.set(p.x - fwdX * back, 4.2 + speed * 0.03, -p.y - fwdZ * back);
    const k = 1 - Math.exp(-dt * 4); // frame-rate independent smoothing
    cur.current.lerp(tmpTarget.current, k);
    camera.position.copy(cur.current);

    // Collision shake: random offset scaled by the decaying impulse.
    const shake = client.fxRef.collision;
    if (shake > 0.02) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.5;
      camera.position.y += (Math.random() - 0.5) * shake * 0.35;
      camera.position.z += (Math.random() - 0.5) * shake * 0.5;
    }

    const aheadDist = 4 + speed * 0.15;
    tmpAhead.current.set(p.x + fwdX * aheadDist, 1.2, -p.y + fwdZ * aheadDist);
    look.current.lerp(tmpAhead.current, 1 - Math.exp(-dt * 6));
    camera.lookAt(look.current);

    const cam = camera as THREE.PerspectiveCamera;
    const targetFov = 60 + Math.min(12, speed * 0.35);
    cam.fov += (targetFov - cam.fov) * k;
    cam.updateProjectionMatrix();
  });

  return null;
}
