import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { worldToTrackMap, type WorldMap } from '@tandem/shared';
import type { GameClient } from '../game/client.js';

/** Floating, spinning ring marking the next checkpoint. */
export function Gates({ client, world }: { client: GameClient; world: WorldMap }): JSX.Element {
  const ref = useRef<THREE.Mesh>(null);
  const gates = useMemo(() => worldToTrackMap(world).checkpoints, [world]);

  useFrame(({ clock }) => {
    const i = client.getState().race?.nextCheckpoint ?? -1;
    const m = ref.current;
    if (!m) return;
    const gate = i >= 0 ? gates[i] : undefined;
    if (!gate) {
      m.visible = false;
      return;
    }
    m.visible = true;
    m.position.set(gate.x, 2.2 + Math.sin(clock.elapsedTime * 2) * 0.4, -gate.y);
    m.rotation.y = clock.elapsedTime * 0.8;
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[3.2, 0.28, 10, 32]} />
      <meshStandardMaterial color="#34d399" emissive="#0f8a5f" emissiveIntensity={0.7} />
    </mesh>
  );
}
