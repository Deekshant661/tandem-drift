import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * One attractive, simple lake — gentle animated ripple and a soft sparkling
 * specular highlight via a small custom shader (time uniform only, no
 * real-time reflection or simulation). Static geometry, one material.
 */
export function FernvaleLake({
  x,
  y,
  radius,
}: {
  x: number;
  y: number;
  radius: number;
}): JSX.Element {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#4aa8e0') } },
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          varying float vRipple;
          void main() {
            vUv = uv;
            vec3 p = position;
            float r = length(p.xy);
            vRipple = sin(r * 0.6 - uTime * 1.1) * 0.06 + sin(r * 1.3 + uTime * 0.7) * 0.03;
            p.z += vRipple;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uTime;
          varying vec2 vUv;
          varying float vRipple;
          void main() {
            float sparkle = pow(max(0.0, sin(vUv.x * 60.0 + uTime * 1.6) * sin(vUv.y * 60.0 - uTime * 1.3)), 8.0);
            vec3 col = uColor + vRipple * 0.6 + sparkle * 0.5;
            gl_FragColor = vec4(col, 0.92);
          }
        `,
        transparent: true,
      }),
    [],
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
  });

  return (
    <group position={[x, 0.03, -y]}>
      <mesh rotation-x={-Math.PI / 2} material={material}>
        <circleGeometry args={[radius, 40]} />
      </mesh>
    </group>
  );
}
