import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32, type WorldMap, type Zone } from '@tandem/shared';
import { scatterWorld, type Placement } from './scatter.js';
import { buildProp } from './props.js';

/**
 * All Willowbrook scenery, grouped by zone into independently mountable
 * chunks (streaming-ready: future larger maps can load/unload zone groups
 * without architectural changes). Everything is deterministic from the world
 * seed, so both players see the identical countryside.
 */
export function Environment({ world }: { world: WorldMap }): JSX.Element {
  const zoneGroups = useMemo(() => {
    const placements = scatterWorld(world);
    const byZone = new Map<string, Placement[]>();
    for (const p of placements) {
      const list = byZone.get(p.zone) ?? [];
      list.push(p);
      byZone.set(p.zone, list);
    }
    // Build one THREE.Group per zone; static, so build imperatively once.
    const groups: THREE.Group[] = [];
    for (const [zone, list] of byZone) {
      const g = new THREE.Group();
      g.name = `zone-${zone}`;
      for (const p of list) {
        const obj = buildProp(p.kind);
        obj.position.set(p.x, 0, -p.y);
        obj.rotation.y = p.rotation;
        obj.scale.setScalar(p.scale);
        g.add(obj);
      }
      groups.push(g);
    }
    return groups;
  }, [world]);

  return (
    <group>
      {zoneGroups.map((g) => (
        <primitive key={g.name} object={g} />
      ))}
      <Lake world={world} />
      <Landmarks world={world} />
      <Clouds seed={world.seed} />
    </group>
  );
}

/** Flat water disc + darker shore ring for the lake zone. */
function Lake({ world }: { world: WorldMap }): JSX.Element | null {
  const lake = world.zones.find((z: Zone) => z.kind === 'lake');
  if (!lake) return null;
  return (
    <group position={[lake.x, 0, -lake.y]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[lake.radius * 0.75, 28]} />
        <meshStandardMaterial color="#4aa8e0" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
        <circleGeometry args={[lake.radius * 0.82, 28]} />
        <meshStandardMaterial color="#c9b98a" />
      </mesh>
    </group>
  );
}

/** Windmills (spinning blades), the wooden bridge, and the rock tunnel arch. */
function Landmarks({ world }: { world: WorldMap }): JSX.Element {
  const bladeRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => {
    for (const b of bladeRefs.current) {
      if (b) b.rotation.z += dt * 0.6;
    }
  });

  const windmills = world.landmarks.filter((l) => l.kind === 'windmill');
  const bridges = world.landmarks.filter((l) => l.kind === 'bridge');

  return (
    <group>
      {windmills.map((w, i) => (
        <group key={`wm${i}`} position={[w.x, 0, -w.y]} rotation-y={w.rotation}>
          {/* tower */}
          <mesh castShadow position-y={4}>
            <cylinderGeometry args={[1.2, 2.0, 8, 8]} />
            <meshStandardMaterial color="#e8dcc3" flatShading />
          </mesh>
          <mesh position-y={8.6}>
            <coneGeometry args={[1.5, 1.6, 8]} />
            <meshStandardMaterial color="#a34d3f" flatShading />
          </mesh>
          {/* hub + 4 blades */}
          <group position={[0, 7.6, 1.6]} ref={(el) => (bladeRefs.current[i] = el)}>
            {[0, 1, 2, 3].map((b) => (
              <mesh key={b} rotation-z={(b * Math.PI) / 2} position-y={0}>
                <boxGeometry args={[0.4, 5.2, 0.08]} />
                <meshStandardMaterial color="#f4ede0" />
              </mesh>
            ))}
          </group>
        </group>
      ))}
      {bridges.map((b, i) => (
        <group key={`br${i}`} position={[b.x, 0, -b.y]} rotation-y={b.rotation}>
          {/* deck slightly above the road surface, wooden rails both sides */}
          <mesh position-y={0.06}>
            <boxGeometry args={[18, 0.12, 9.5]} />
            <meshStandardMaterial color="#a87f52" />
          </mesh>
          {[-4.9, 4.9].map((z) => (
            <group key={z}>
              <mesh position={[0, 0.7, z]}>
                <boxGeometry args={[18, 0.12, 0.12]} />
                <meshStandardMaterial color="#8a5a33" />
              </mesh>
              {[-7, -3.5, 0, 3.5, 7].map((x) => (
                <mesh key={x} position={[x, 0.35, z]}>
                  <boxGeometry args={[0.14, 0.7, 0.14]} />
                  <meshStandardMaterial color="#8a5a33" />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
      <TunnelArch world={world} />
    </group>
  );
}

/** Rock arch over the road at the tunnel zone (visual; walls come from the map). */
function TunnelArch({ world }: { world: WorldMap }): JSX.Element | null {
  const tunnel = world.zones.find((z) => z.kind === 'tunnel');
  if (!tunnel) return null;
  return (
    <group position={[tunnel.x, 0, -tunnel.y]}>
      <mesh castShadow position-y={4.5}>
        <torusGeometry args={[7, 2.6, 6, 10, Math.PI]} />
        <meshStandardMaterial color="#8d949e" flatShading />
      </mesh>
    </group>
  );
}

/** Puffy cartoon clouds drifting slowly overhead. */
function Clouds({ seed }: { seed: number }): JSX.Element {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const rng = mulberry32(seed ^ 0xc10d5);
    return Array.from({ length: 14 }, () => ({
      x: (rng() - 0.5) * 900,
      y: 90 + rng() * 60,
      z: (rng() - 0.5) * 900,
      scale: 8 + rng() * 14,
      speed: 0.5 + rng() * 1.2,
    }));
  }, [seed]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      c.position.x += clouds[i]!.speed * dt;
      if (c.position.x > 480) c.position.x = -480;
    });
  });

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.scale}>
          <mesh>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#ffffff" flatShading fog={false} />
          </mesh>
          <mesh position={[0.9, -0.1, 0.2]} scale={0.7}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#f4faff" flatShading fog={false} />
          </mesh>
          <mesh position={[-0.8, -0.15, -0.1]} scale={0.6}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#f4faff" flatShading fog={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
