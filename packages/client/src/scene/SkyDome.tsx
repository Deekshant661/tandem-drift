import { useMemo } from 'react';
import * as THREE from 'three';
import { mulberry32 } from '@tandem/shared';

/**
 * Gradient sky dome + two layered horizon rings (near green hills, far blue
 * mountains) for depth. Each ring is one continuous connected strip — every
 * segment shares its edge vertices with its neighbors, so there are no gaps
 * where fog could show through and make peaks look like they're floating.
 */
function buildRidge(
  seed: number,
  radius: number,
  segments: number,
  minHeight: number,
  maxHeight: number,
  colorLow: string,
  colorHigh: string,
): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  // Two octaves of noise (coarse + fine) so the skyline isn't one dominant
  // bump — a run of small peaks reads as a proper mountain range, not a lone
  // triangle.
  const coarse = Array.from({ length: 6 }, () => rng());
  const heightAt = (i: number): number => {
    const c = coarse[Math.floor((i / segments) * coarse.length) % coarse.length]!;
    const fine = rng();
    return minHeight + (maxHeight - minHeight) * (c * 0.6 + fine * 0.4);
  };
  const peaks = Array.from({ length: segments + 1 }, (_, i) => heightAt(i));
  const low = new THREE.Color(colorLow);
  const high = new THREE.Color(colorHigh);

  const positions: number[] = [];
  const colors: number[] = [];
  const pushVertex = (x: number, y: number, z: number, t: number): void => {
    positions.push(x, y, z);
    const c = low.clone().lerp(high, t);
    colors.push(c.r, c.g, c.b);
  };

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const base0 = { x: Math.cos(a0) * radius, z: Math.sin(a0) * radius };
    const base1 = { x: Math.cos(a1) * radius, z: Math.sin(a1) * radius };
    const p0 = peaks[i]!;
    const p1 = peaks[i + 1]!;
    // Two triangles sharing the base0-base1 edge with the next segment —
    // a fully connected ridge, never a disconnected floating spike.
    pushVertex(base0.x, 0, base0.z, 0);
    pushVertex(base0.x, p0, base0.z, 1);
    pushVertex(base1.x, p1, base1.z, 1);
    pushVertex(base0.x, 0, base0.z, 0);
    pushVertex(base1.x, p1, base1.z, 1);
    pushVertex(base1.x, 0, base1.z, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export function SkyDome({ seed }: { seed: number }): JSX.Element {
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          zenith: { value: new THREE.Color('#3f7fc9') },
          mid: { value: new THREE.Color('#bfe0f0') },
          horizon: { value: new THREE.Color('#ffe6c2') },
        },
        vertexShader: `varying float h; void main(){ h = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying float h; uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon;
          void main(){
            float t = clamp(h * 2.2, 0.0, 1.0);
            vec3 lower = mix(horizon, mid, smoothstep(0.0, 0.5, t));
            vec3 col = mix(lower, zenith, smoothstep(0.35, 1.0, t));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  );

  const hills = useMemo(
    () => buildRidge(seed ^ 0x1a11, 420, 40, 8, 26, '#6fa855', '#8fbf74'),
    [seed],
  );
  const mountains = useMemo(
    () => buildRidge(seed ^ 0x4079a, 620, 48, 45, 120, '#7f96b4', '#c8d9e8'),
    [seed],
  );

  // Sun glow: an unlit bright disc placed opposite the directional light's
  // travel direction, so it reads as the light source and bloom picks it up.
  const sunDir = useMemo(() => new THREE.Vector3(110, 160, 55).normalize(), []);

  return (
    <group>
      <mesh material={skyMat}>
        <sphereGeometry args={[820, 24, 12]} />
      </mesh>
      {/* Sprite always faces the camera, so the sun glow reads correctly from any angle. */}
      <sprite position={sunDir.clone().multiplyScalar(780).toArray()} scale={[70, 70, 1]}>
        <spriteMaterial color="#fff3d6" fog={false} toneMapped={false} depthWrite={false} />
      </sprite>
      {/* Hills/mountains keep fog on so they haze naturally into the horizon. */}
      <mesh geometry={hills}>
        <meshStandardMaterial vertexColors flatShading />
      </mesh>
      <mesh geometry={mountains}>
        <meshStandardMaterial vertexColors flatShading />
      </mesh>
    </group>
  );
}
