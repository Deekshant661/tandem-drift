import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameClient } from '../game/client.js';

/** Placeholder vehicle until M2's compact01. Samples the pose ref per frame. */
export function BoxCar({ client }: { client: GameClient }): JSX.Element {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    client.samplePose(performance.now());
    const p = client.poseRef.current;
    const g = ref.current;
    if (!p || !g) return;
    g.position.set(p.x, 0, -p.y);
    g.rotation.y = p.angle;
  });

  return (
    <group ref={ref}>
      <mesh castShadow position-y={0.55}>
        <boxGeometry args={[1.8, 0.7, 4.0]} />
        <meshStandardMaterial color="#e0484d" />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0.3]}>
        <boxGeometry args={[1.5, 0.45, 1.7]} />
        <meshStandardMaterial color="#f9e3e0" />
      </mesh>
    </group>
  );
}
