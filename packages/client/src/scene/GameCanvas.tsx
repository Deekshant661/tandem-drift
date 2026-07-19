import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import type { WorldMap } from '@tandem/shared';
import { Environment } from './environment/Environment.js';
import { Particles } from './effects/Particles.js';
import { SkidMarks } from './effects/SkidMarks.js';
import type { GameClient } from '../game/client.js';
import { SkyDome } from './SkyDome.js';
import { Ground } from './Ground.js';
import { RoadMesh } from './RoadMesh.js';
import { Gates } from './Gates.js';
import { Vehicle } from './vehicle/Vehicle.js';
import { compact01 } from './vehicle/spec.js';
import { ChaseCamera } from './ChaseCamera.js';

/**
 * The 3D scene. Coordinate convention everywhere in scene code:
 * sim (x, y) → three (x, 0, -y); sim heading a → three rotationY = a.
 */
export function GameCanvas({
  client,
  world,
}: {
  client: GameClient;
  world: WorldMap;
}): JSX.Element {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 60, near: 0.5, far: 900 }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <color attach="background" args={['#aee2ff']} />
      <fog attach="fog" args={['#cfe8ff', 120, 650]} />
      <ambientLight intensity={0.55} color="#eaf6ff" />
      <directionalLight
        position={[120, 180, 60]}
        intensity={1.6}
        color="#fff4d6"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <SkyDome />
      <Ground />
      <RoadMesh world={world} />
      <Gates client={client} world={world} />
      <Vehicle client={client} spec={compact01} />
      <Environment world={world} />
      <Particles client={client} />
      <SkidMarks client={client} />
      <ChaseCamera client={client} />
      {/* Subtle bloom: sun-lit emissives (headlights, lamps, gate ring) glow. */}
      <EffectComposer>
        <Bloom intensity={0.35} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
