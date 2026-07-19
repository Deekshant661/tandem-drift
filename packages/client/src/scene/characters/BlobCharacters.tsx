import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameClient } from '../../game/client.js';
import { computeRigPose } from './rig.js';

/**
 * The two riders as charming capsule blobs — the MVP CharacterRig
 * implementation. Pilot wears a gold cap; engineer a green scarf. Poses come
 * from the pure rig math; swapping in modeled characters later only replaces
 * this component.
 */
export function BlobCharacters({
  client,
  seats,
}: {
  client: GameClient;
  seats: [number, number, number][];
}): JSX.Element {
  const pilotBody = useRef<THREE.Group>(null);
  const pilotHead = useRef<THREE.Group>(null);
  const engBody = useRef<THREE.Group>(null);
  const engHead = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const p = client.poseRef.current;
    if (!p) return;
    const c = client.controlsRef.current;
    const speed = Math.hypot(p.vx, p.vy);
    const time = clock.elapsedTime;
    const collision = client.fxRef.collision;

    const apply = (
      seat: 'pilot' | 'engineer',
      bodyRef: React.RefObject<THREE.Group>,
      headRef: React.RefObject<THREE.Group>,
      seatIdx: number,
    ): void => {
      const body = bodyRef.current;
      const head = headRef.current;
      if (!body || !head) return;
      const pose = computeRigPose({
        seat,
        speed,
        steer: c.steer,
        throttle: c.throttle,
        brake: c.brake,
        collision,
        time,
      });
      const [sx, sy, sz] = seats[seatIdx]!;
      body.position.set(sx, sy + pose.bounceY + pose.joltY, -sz);
      body.rotation.set(pose.leanPitch, 0, pose.leanRoll);
      head.rotation.y = pose.headYaw;
    };

    apply('pilot', pilotBody, pilotHead, 0);
    apply('engineer', engBody, engHead, 1);
  });

  return (
    <group>
      {/* pilot: cream blob, gold cap */}
      <group ref={pilotBody}>
        <mesh castShadow position-y={0.22}>
          <capsuleGeometry args={[0.17, 0.24, 4, 10]} />
          <meshStandardMaterial color="#f8e8d8" />
        </mesh>
        <group ref={pilotHead} position-y={0.52}>
          <mesh castShadow>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#f8e8d8" />
          </mesh>
          <mesh position-y={0.11}>
            <cylinderGeometry args={[0.16, 0.16, 0.07, 12]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
          {/* cap brim points forward (local -z) */}
          <mesh position={[0, 0.09, -0.15]}>
            <boxGeometry args={[0.18, 0.03, 0.12]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
        </group>
      </group>
      {/* engineer: cream blob, green scarf */}
      <group ref={engBody}>
        <mesh castShadow position-y={0.22}>
          <capsuleGeometry args={[0.17, 0.24, 4, 10]} />
          <meshStandardMaterial color="#efe0cf" />
        </mesh>
        <mesh position-y={0.4} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.13, 0.045, 8, 14]} />
          <meshStandardMaterial color="#34d399" />
        </mesh>
        <group ref={engHead} position-y={0.52}>
          <mesh castShadow>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#efe0cf" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
