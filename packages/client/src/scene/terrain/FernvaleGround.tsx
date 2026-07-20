import { useMemo } from 'react';
import * as THREE from 'three';
import { sampleRoad, type WorldMap } from '@tandem/shared';
import { terrainHeight, type RoadFlattenPoint } from './heightfield.js';
import { FERNVALE_TERRAIN_FEATURES } from './fernvaleTerrainFeatures.js';
import { atmosphereAt } from '../environment/fernvaleAtmosphere.js';

const GRID_SIZE = 240; // meters, covers the ~150m-radius loop plus margin
const GRID_RES = 96; // vertices per side — one draw call, no per-frame cost

/**
 * Fernvale's heightmapped ground: flat exactly on the road corridor,
 * rising into hand-authored hills/valley/cliff further out, with a subtle
 * per-vertex color bias toward each stretch's atmosphere (warmer near the
 * village/fields, cooler near the forest/lake) so the ground itself
 * participates in the continuous-atmosphere blend, not just the fog.
 */
export function FernvaleGround({ world }: { world: WorldMap }): JSX.Element {
  const geometry = useMemo(() => {
    const road = world.roads[0]!;
    const samples = sampleRoad(road, 8);
    const flattenPoints: RoadFlattenPoint[] = samples.map((s) => ({ x: s.x, y: s.y, width: s.width }));

    // Precompute cumulative arc-length per sample for a t-position lookup.
    const cum: number[] = [0];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!;
      const b = samples[i]!;
      cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
    }
    const total = cum[cum.length - 1]! || 1;

    const nearestT = (x: number, y: number): number => {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i]!;
        const d = (x - s.x) ** 2 + (y - s.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return cum[best]! / total;
    };

    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_RES, GRID_RES);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color('#6fa651');
    const rich = new THREE.Color('#588a41');

    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      // Scene convention: sim (x, y) -> three (x, 0, -y).
      const simX = px;
      const simY = -pz;
      const h = terrainHeight(simX, simY, flattenPoints, FERNVALE_TERRAIN_FEATURES, world.seed);
      pos.setY(i, h);

      const t = nearestT(simX, simY);
      const bias = new THREE.Color(atmosphereAt(t).paletteBias);
      const c = base.clone().lerp(rich, 0.35).lerp(bias, 0.22);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [world]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}
