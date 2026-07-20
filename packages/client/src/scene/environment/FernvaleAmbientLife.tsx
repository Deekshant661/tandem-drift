import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Small, cheap animated touches that make Fernvale feel alive without any
 * gameplay meaning: a few birds circling high overhead, butterflies near
 * the flower beds and village, fireflies near the forest/lake, and chimney
 * smoke above the village houses. Every system here is a handful of
 * instances (tens, not hundreds) updated per-frame — negligible CPU cost,
 * unlike the hundreds-of-objects scatter this phase deliberately avoids.
 */
export function FernvaleAmbientLife(): JSX.Element {
  return (
    <>
      <Birds />
      <Fliers colorA="#ffce54" colorB="#f76b8a" cx={118} cy={5} radius={9} count={6} bob={0.6} />
      <Fliers colorA="#ffe27a" colorB="#ffe27a" cx={20} cy={-105} radius={14} count={8} bob={1.1} glow />
      <Fliers colorA="#c9f2ff" colorB="#c9f2ff" cx={-100} cy={-58} radius={16} count={8} bob={0.5} glow />
      <ChimneySmoke x={-40} y={128} />
      <ChimneySmoke x={40} y={130} />
    </>
  );
}

/** A handful of simple bird shapes on slow circular flight paths, high overhead. */
function Birds(): JSX.Element {
  const ref = useRef<THREE.InstancedMesh>(null);
  const flock = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        cx: -20 + i * 30,
        cy: -20 + (i % 3) * 40,
        radius: 40 + i * 6,
        height: 70 + i * 4,
        speed: 0.15 + i * 0.02,
        phase: i * 1.7,
      })),
    [],
  );
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // Simple flat "V" wing silhouette.
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.6, 0, 0, 0, 0, 0.25, 0.6, 0, 0, 0, 0, -0.15], 3),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  }, []);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    flock.forEach((b, i) => {
      const a = t * b.speed + b.phase;
      const x = b.cx + Math.cos(a) * b.radius;
      const z = -(b.cy + Math.sin(a) * b.radius);
      tmp.position.set(x, b.height + Math.sin(t * 2 + b.phase) * 1.5, z);
      tmp.rotation.y = -a + Math.PI / 2;
      tmp.rotation.z = Math.sin(t * 8 + b.phase) * 0.3; // wing flap
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, flock.length]} frustumCulled={false}>
      <meshBasicMaterial color="#2b2f36" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

/** Butterflies or fireflies: small glowing/colored points drifting in a loose orbit. */
function Fliers({
  colorA,
  colorB,
  cx,
  cy,
  radius,
  count,
  bob,
  glow = false,
}: {
  colorA: string;
  colorB: string;
  cx: number;
  cy: number;
  radius: number;
  count: number;
  bob: number;
  glow?: boolean;
}): JSX.Element {
  const ref = useRef<THREE.Points>(null);
  const specs = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle0: (i / count) * Math.PI * 2,
        radius: radius * (0.4 + 0.6 * ((i * 37) % 10) / 10),
        speed: 0.25 + ((i * 13) % 10) / 30,
        heightPhase: i * 1.3,
        color: i % 2 === 0 ? colorA : colorB,
      })),
    [count, radius, colorA, colorB],
  );
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const colors = new Float32Array(count * 3);
    specs.forEach((s, i) => {
      const c = new THREE.Color(s.color);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [count, specs]);

  useFrame(({ clock }) => {
    const points = ref.current;
    if (!points) return;
    const t = clock.elapsedTime;
    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    specs.forEach((s, i) => {
      const a = s.angle0 + t * s.speed;
      const x = cx + Math.cos(a) * s.radius;
      const y = 0.6 + bob + Math.sin(t * 1.4 + s.heightPhase) * bob;
      const z = -(cy + Math.sin(a) * s.radius);
      pos.setXYZ(i, x, y, z);
    });
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={glow ? 0.5 : 0.35}
        vertexColors
        transparent
        opacity={glow ? 0.9 : 0.85}
        depthWrite={false}
        blending={glow ? THREE.AdditiveBlending : THREE.NormalBlending}
        sizeAttenuation
      />
    </points>
  );
}

/** A few soft, slowly rising smoke puffs above a chimney position. */
function ChimneySmoke({ x, y }: { x: number; y: number }): JSX.Element {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 6;
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    return g;
  }, []);

  useFrame(({ clock }) => {
    const points = ref.current;
    if (!points) return;
    const t = clock.elapsedTime;
    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const life = ((t * 0.3 + i / COUNT) % 1);
      pos.setXYZ(i, x + Math.sin(t * 0.5 + i) * 0.4, 8 + life * 5, -y + Math.cos(t * 0.4 + i) * 0.3);
    }
    pos.needsUpdate = true;
    (points.material as THREE.PointsMaterial).opacity = 0.35;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={1.6}
        color="#dcdcdc"
        transparent
        opacity={0.3}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
