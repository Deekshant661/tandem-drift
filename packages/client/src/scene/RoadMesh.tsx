import { useMemo } from 'react';
import * as THREE from 'three';
import { sampleRoad, type WorldMap } from '@tandem/shared';

/**
 * Road ribbon tessellated from the same spline the server's walls come from.
 * Coordinate convention (all scene code): sim (x, y) → three (x, 0, -y).
 */
export function RoadMesh({ world }: { world: WorldMap }): JSX.Element {
  const { paved, edges } = useMemo(() => {
    const road = world.roads[0]!;
    const s = sampleRoad(road, 12);
    const n = s.length;

    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = s[i]!;
      const nx = -p.ty;
      const ny = p.tx;
      pos.push(p.x + nx * p.width, 0, -(p.y + ny * p.width));
      pos.push(p.x - nx * p.width, 0, -(p.y - ny * p.width));
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      const b = ((i + 1) % n) * 2;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    // White edge lines slightly above the surface.
    const epos: number[] = [];
    for (const off of [0.92, -0.92]) {
      for (let i = 0; i < n; i++) {
        const p = s[i]!;
        const q = s[(i + 1) % n]!;
        const nx1 = -p.ty, ny1 = p.tx;
        const nx2 = -q.ty, ny2 = q.tx;
        epos.push(p.x + nx1 * p.width * off, 0.03, -(p.y + ny1 * p.width * off));
        epos.push(q.x + nx2 * q.width * off, 0.03, -(q.y + ny2 * q.width * off));
      }
    }
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(epos, 3));

    return { paved: geo, edges: edgeGeo };
  }, [world]);

  return (
    <group>
      <mesh geometry={paved} receiveShadow position-y={0.01}>
        <meshStandardMaterial color="#5a5f6b" />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#ffffff" />
      </lineSegments>
    </group>
  );
}
