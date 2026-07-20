import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import type { WorldMap } from '@tandem/shared';
import type { GameClient } from '../game/client.js';
import { SkyDome } from './SkyDome.js';
import { Ground } from './Ground.js';
import { RoadMesh } from './RoadMesh.js';
import { Gates } from './Gates.js';
import { Vehicle } from './vehicle/Vehicle.js';
import { compact01 } from './vehicle/spec.js';
import { Environment } from './environment/Environment.js';
import { FernvaleEnvironment } from './environment/FernvaleEnvironment.js';
import { FernvaleGround } from './terrain/FernvaleGround.js';
import { Particles } from './effects/Particles.js';
import { SkidMarks } from './effects/SkidMarks.js';
import { ChaseCamera } from './ChaseCamera.js';
import { PerfStats } from './PerfStats.js';

interface LightingTheme {
  background: string;
  fog: [string, number, number];
  hemi: [string, string, number];
  sunPos: [number, number, number];
  sunColor: string;
  sunIntensity: number;
}

/** Per-map lighting/fog treatment. Willowbrook keeps its original midday
 *  look untouched; Fernvale gets a golden-hour signature per its design. */
const LIGHTING: Record<'default' | 'fernvale', LightingTheme> = {
  default: {
    background: '#bfe0f0',
    fog: ['#cfe0ea', 130, 620],
    hemi: ['#cfe6ff', '#6b8c4a', 0.65],
    sunPos: [110, 160, 55],
    sunColor: '#ffe6b8',
    sunIntensity: 1.5,
  },
  fernvale: {
    background: '#f3c98a',
    fog: ['#e8c497', 100, 560],
    hemi: ['#ffdfae', '#7a8c4a', 0.6],
    sunPos: [-70, 60, 90],
    sunColor: '#ffb15e',
    sunIntensity: 1.9,
  },
};

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
  const isFernvale = world.name === 'fernvale';
  const theme = isFernvale ? LIGHTING.fernvale : LIGHTING.default;

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.5]}
      camera={{ fov: 60, near: 0.5, far: 900 }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={theme.fog} />
      <hemisphereLight args={theme.hemi} />
      <directionalLight
        position={theme.sunPos}
        intensity={theme.sunIntensity}
        color={theme.sunColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-far={60}
      />
      <SkyDome seed={world.seed} />
      {isFernvale ? <FernvaleGround world={world} /> : <Ground seed={world.seed} />}
      <RoadMesh world={world} />
      <Gates client={client} world={world} />
      <Vehicle client={client} spec={compact01} />
      {isFernvale ? <FernvaleEnvironment /> : <Environment world={world} />}
      <Particles client={client} />
      <SkidMarks client={client} />
      <ChaseCamera client={client} />
      <PerfStats />
      {/* Subtle bloom: sun-lit emissives (headlights, lamps, gate ring) glow.
          mipmapBlur disabled and resolution kept default — cheaper pass. */}
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.25} luminanceThreshold={0.88} luminanceSmoothing={0.2} />
      </EffectComposer>
    </Canvas>
  );
}
