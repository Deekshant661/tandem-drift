import { useMemo } from 'react';
import * as THREE from 'three';
import { sampleRoad, type RoadSample, type WorldMap } from '@tandem/shared';

/** Full-width ribbon through the centerline, at a fraction of local road width. */
function buildFullRibbon(samples: RoadSample[], widthFactor: number): THREE.BufferGeometry {
  const n = samples.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = samples[i]!;
    const nx = -p.ty;
    const ny = p.tx;
    const w = p.width * widthFactor;
    pos.push(p.x + nx * w, 0, -(p.y + ny * w));
    pos.push(p.x - nx * w, 0, -(p.y - ny * w));
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
  return geo;
}

/** One-sided strip (dirt shoulder) between two width fractions on `side`,
 *  with vertex colors fading from `innerColor` at the road edge to
 *  `outerColor` (grass) so it blends instead of cutting off sharply. */
function buildShoulderStrip(
  samples: RoadSample[],
  side: 1 | -1,
  innerFactor: number,
  outerFactor: number,
  innerColor: string,
  outerColor: string,
): THREE.BufferGeometry {
  const n = samples.length;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const cIn = new THREE.Color(innerColor);
  const cOut = new THREE.Color(outerColor);
  for (let i = 0; i < n; i++) {
    const p = samples[i]!;
    const nx = -p.ty * side;
    const ny = p.tx * side;
    pos.push(p.x + nx * p.width * innerFactor, 0, -(p.y + ny * p.width * innerFactor));
    pos.push(p.x + nx * p.width * outerFactor, 0, -(p.y + ny * p.width * outerFactor));
    col.push(cIn.r, cIn.g, cIn.b, cOut.r, cOut.g, cOut.b);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Road as an actual road: asphalt, dirt shoulders that fade into the grass,
 * a painted center line, white edge lines, and a light curb lip —
 * tessellated from the same spline the server's walls come from.
 * Coordinate convention (all scene code): sim (x, y) → three (x, 0, -y).
 * A handful of static draw calls; nothing here runs per frame.
 */
export function RoadMesh({ world }: { world: WorldMap }): JSX.Element {
  const { asphalt, shoulderL, shoulderR, curbL, curbR, edgeL, edgeR, centerLine } = useMemo(() => {
    const road = world.roads[0]!;
    const s = sampleRoad(road, 12);
    return {
      asphalt: buildFullRibbon(s, 1.0),
      shoulderL: buildShoulderStrip(s, 1, 0.94, 1.4, '#a9895c', '#6fa651'),
      shoulderR: buildShoulderStrip(s, -1, 0.94, 1.4, '#a9895c', '#6fa651'),
      curbL: buildShoulderStrip(s, 1, 0.97, 1.02, '#dfe3e8', '#dfe3e8'),
      curbR: buildShoulderStrip(s, -1, 0.97, 1.02, '#dfe3e8', '#dfe3e8'),
      edgeL: buildShoulderStrip(s, 1, 0.88, 0.9, '#f4f4f4', '#f4f4f4'),
      edgeR: buildShoulderStrip(s, -1, 0.88, 0.9, '#f4f4f4', '#f4f4f4'),
      centerLine: buildFullRibbon(s, 0.045),
    };
  }, [world]);

  return (
    <group>
      <mesh geometry={shoulderL} receiveShadow position-y={0.008}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh geometry={shoulderR} receiveShadow position-y={0.008}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh geometry={asphalt} receiveShadow position-y={0.015}>
        <meshStandardMaterial color="#4d4b52" roughness={0.95} />
      </mesh>
      <mesh geometry={edgeL} position-y={0.018}>
        <meshStandardMaterial vertexColors />
      </mesh>
      <mesh geometry={edgeR} position-y={0.018}>
        <meshStandardMaterial vertexColors />
      </mesh>
      <mesh geometry={curbL} position-y={0.02}>
        <meshStandardMaterial vertexColors />
      </mesh>
      <mesh geometry={curbR} position-y={0.02}>
        <meshStandardMaterial vertexColors />
      </mesh>
      <mesh geometry={centerLine} position-y={0.022}>
        <meshStandardMaterial color="#f2c94c" />
      </mesh>
    </group>
  );
}
