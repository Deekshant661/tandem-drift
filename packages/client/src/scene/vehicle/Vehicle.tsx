import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameClient } from '../../game/client.js';
import type { VehicleSpec } from './spec.js';
import { BlobCharacters } from '../characters/BlobCharacters.js';

/**
 * Spec-driven vehicle. Local convention: the car's front is local -z (three
 * group rotation.y = sim angle makes local -z the travel direction), so spec
 * "z = forward" positions are negated when placed.
 *
 * Animations, all driven from poseRef/controlsRef/fxRef (never React state):
 * wheels spin with speed and the front pair steers; the body bobs on its
 * suspension, pitches under throttle/brake and rolls into corners; brake
 * lights glow on brake, reverse lights when actually reversing; headlights
 * are always on (cozy daytime running lights); collisions jolt the chassis.
 */
export function Vehicle({
  client,
  spec,
}: {
  client: GameClient;
  spec: VehicleSpec;
}): JSX.Element {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const steerGroups = useRef<(THREE.Group | null)[]>([]);
  const spinGroups = useRef<(THREE.Group | null)[]>([]);
  const brakeMat = useRef<THREE.MeshStandardMaterial>(null);
  const reverseMat = useRef<THREE.MeshStandardMaterial>(null);
  const steerVis = useRef(0);

  const rand = useMemo(() => ({ x: 0, z: 0 }), []);

  useFrame((_, dt) => {
    client.samplePose(performance.now());
    const p = client.poseRef.current;
    const g = root.current;
    const b = body.current;
    if (!p || !g || !b) return;

    g.position.set(p.x, 0, -p.y);
    g.rotation.y = p.angle;

    const c = client.controlsRef.current;
    const speed = Math.hypot(p.vx, p.vy);
    // Signed forward speed: sim forward is (-sin a, cos a).
    const vf = p.vx * -Math.sin(p.angle) + p.vy * Math.cos(p.angle);

    // Wheels: spin by arc length; front pair steers (visual smoothing).
    steerVis.current += (c.steer * 0.45 - steerVis.current) * Math.min(1, dt * 10);
    for (let i = 0; i < 4; i++) {
      const spin = spinGroups.current[i];
      if (spin) spin.rotation.x -= (vf * dt) / spec.wheels.radius;
      const steer = steerGroups.current[i];
      if (steer && i < 2) steer.rotation.y = steerVis.current;
    }

    // Suspension: bob + pitch + roll on the body group.
    client.fxRef.collision *= Math.exp(-dt * 4);
    const jolt = client.fxRef.collision;
    if (jolt > 0.02) {
      rand.x = (Math.random() - 0.5) * jolt * 0.08;
      rand.z = (Math.random() - 0.5) * jolt * 0.08;
    } else {
      rand.x = 0;
      rand.z = 0;
    }
    const speedNorm = Math.min(1, speed / 30);
    b.position.y =
      0.02 * speedNorm * Math.sin(performance.now() * 0.02 * (1 + speedNorm)) +
      jolt * 0.1 +
      rand.x;
    b.rotation.x = c.throttle * 0.03 * speedNorm - c.brake * 0.05 * speedNorm + rand.z;
    b.rotation.z = -c.steer * 0.06 * speedNorm;

    // Lights.
    if (brakeMat.current) {
      brakeMat.current.emissiveIntensity = c.brake > 0 ? 2.2 : 0.25;
    }
    if (reverseMat.current) {
      reverseMat.current.emissiveIntensity = vf < -0.3 ? 1.8 : 0;
    }
  });

  const w = spec.wheels;
  return (
    <group ref={root}>
      <group ref={body}>
        {/* chassis */}
        <mesh castShadow position={[0, spec.chassis.yOffset, 0]}>
          <boxGeometry args={[spec.chassis.width, spec.chassis.height, spec.chassis.length]} />
          <meshStandardMaterial color={spec.chassis.color} />
        </mesh>
        {/* cabin tub (open-top) */}
        <mesh castShadow position={[0, spec.cabin.yOffset, -spec.cabin.zOffset]}>
          <boxGeometry args={[spec.cabin.width, spec.cabin.height, spec.cabin.length]} />
          <meshStandardMaterial color={spec.cabin.color} />
        </mesh>
        {/* headlights */}
        {spec.lights.head.map(([x, y, z], i) => (
          <mesh key={`h${i}`} position={[x, y, -z]}>
            <sphereGeometry args={[0.11, 8, 8]} />
            <meshStandardMaterial color="#fff7cf" emissive="#ffe98a" emissiveIntensity={1.4} />
          </mesh>
        ))}
        {/* brake lights */}
        {spec.lights.tail.map(([x, y, z], i) => (
          <mesh key={`t${i}`} position={[x, y, -z]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            {i === 0 ? (
              <meshStandardMaterial
                ref={brakeMat}
                color="#7a1420"
                emissive="#ff2436"
                emissiveIntensity={0.25}
              />
            ) : (
              <meshStandardMaterial
                color="#7a1420"
                emissive="#ff2436"
                emissiveIntensity={0.25}
              />
            )}
          </mesh>
        ))}
        {/* reverse light, centered */}
        <mesh position={[0, spec.lights.tail[0]![1], -(-spec.lights.tail[0]![2])]}>
          <boxGeometry args={[0.28, 0.08, 0.04]} />
          <meshStandardMaterial
            ref={reverseMat}
            color="#e8ecf2"
            emissive="#ffffff"
            emissiveIntensity={0}
          />
        </mesh>
        <BlobCharacters client={client} seats={spec.seats} />
      </group>
      {/* wheels: outer group steers (front pair), inner group spins */}
      {w.positions.map(([x, z], i) => (
        <group key={i} position={[x, w.radius, -z]} ref={(el) => (steerGroups.current[i] = el)}>
          <group ref={(el) => (spinGroups.current[i] = el)}>
            <mesh castShadow rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[w.radius, w.radius, w.thickness, 14]} />
              <meshStandardMaterial color={w.color} />
            </mesh>
            {/* hub cap gives visible spin */}
            <mesh position-x={x > 0 ? w.thickness / 2 + 0.01 : -(w.thickness / 2 + 0.01)}
              rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[w.radius * 0.45, w.radius * 0.45, 0.02, 6]} />
              <meshStandardMaterial color="#cfd6df" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
