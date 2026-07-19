import { useMemo } from 'react';
import * as THREE from 'three';

/** Gradient sky dome + low-poly mountain ring on the horizon. */
export function SkyDome(): JSX.Element {
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color('#5fb8ff') },
          bottom: { value: new THREE.Color('#dff1ff') },
        },
        vertexShader: `varying float h; void main(){ h = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying float h; uniform vec3 top; uniform vec3 bottom;
          void main(){ gl_FragColor = vec4(mix(bottom, top, clamp(h*1.6, 0.0, 1.0)), 1.0); }`,
      }),
    [],
  );

  const mountains = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const R = 700;
    const N = 26;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const a2 = ((i + 0.5) / N) * Math.PI * 2;
      const a3 = ((i + 1) / N) * Math.PI * 2;
      const peak = 60 + ((i * 137) % 70);
      verts.push(
        Math.cos(a) * R, 0, Math.sin(a) * R,
        Math.cos(a2) * R, peak, Math.sin(a2) * R,
        Math.cos(a3) * R, 0, Math.sin(a3) * R,
      );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      <mesh material={skyMat}>
        <sphereGeometry args={[820, 24, 12]} />
      </mesh>
      <mesh geometry={mountains}>
        <meshStandardMaterial color="#7f9bb8" flatShading />
      </mesh>
    </group>
  );
}
