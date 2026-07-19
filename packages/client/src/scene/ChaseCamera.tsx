import { useRef } from 'react';
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

  useFrame(({ camera }, dt) => {
    const p = client.poseRef.current;
    if (!p) return;
    const speed = Math.hypot(p.vx, p.vy);
    const fwdX = -Math.sin(p.angle);
    const fwdZ = -Math.cos(p.angle);

    const back = 9 + Math.min(4, speed * 0.12);
    tmpTarget.current.set(p.x - fwdX * back, 4.2 + speed * 0.03, -p.y - fwdZ * back);
    const k = 1 - Math.exp(-dt * 4); // frame-rate independent smoothing
    cur.current.lerp(tmpTarget.current, k);
    camera.position.copy(cur.current);

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
