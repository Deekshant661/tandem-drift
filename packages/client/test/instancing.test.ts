import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildInstancedProps,
  composeInstanceMatrix,
  isIndividuallyBuilt,
} from '../src/scene/environment/instancing.js';
import type { Placement } from '../src/scene/environment/scatter.js';

function placement(overrides: Partial<Placement> = {}): Placement {
  return { kind: 'rock', x: 10, y: 5, rotation: 0, scale: 1, zone: 'wild', ...overrides };
}

describe('composeInstanceMatrix', () => {
  it('places an identity-local part at the placement position (sim y flips to three -z)', () => {
    const m = composeInstanceMatrix(placement({ x: 3, y: 7 }), new THREE.Matrix4());
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.x).toBeCloseTo(3);
    expect(pos.y).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(-7);
  });

  it('applies placement scale to a local offset', () => {
    const local = new THREE.Matrix4().makeTranslation(1, 0, 0);
    const m = composeInstanceMatrix(placement({ x: 0, y: 0, scale: 2 }), local);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.x).toBeCloseTo(2); // local offset scaled by placement scale
  });

  it('rotates the local offset by the placement rotation', () => {
    const local = new THREE.Matrix4().makeTranslation(1, 0, 0);
    const m = composeInstanceMatrix(placement({ x: 0, y: 0, rotation: Math.PI / 2 }), local);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.x).toBeCloseTo(0, 5);
    expect(pos.z).toBeCloseTo(-1, 5);
  });
});

describe('buildInstancedProps', () => {
  it('produces one InstancedMesh per (kind, part) with the right instance count', () => {
    const placements: Placement[] = [
      placement({ kind: 'rock' }),
      placement({ kind: 'rock', x: 20 }),
      placement({ kind: 'rock', x: 30 }),
    ];
    const meshes = buildInstancedProps(placements);
    // rock() builds a single mesh → exactly one InstancedMesh with count 3.
    expect(meshes).toHaveLength(1);
    expect(meshes[0]).toBeInstanceOf(THREE.InstancedMesh);
    expect((meshes[0] as THREE.InstancedMesh).count).toBe(3);
  });

  it('gives every flower bloom part an instance color', () => {
    const placements: Placement[] = [
      placement({ kind: 'flower' }),
      placement({ kind: 'flower', x: 1 }),
    ];
    const meshes = buildInstancedProps(placements) as THREE.InstancedMesh[];
    // flower() builds stem + bloom → 2 InstancedMeshes; only the bloom gets colors.
    expect(meshes).toHaveLength(2);
    const withColor = meshes.filter((m) => m.instanceColor !== null);
    expect(withColor).toHaveLength(1);
  });

  it('excludes houses from instancing', () => {
    expect(isIndividuallyBuilt('house')).toBe(true);
    expect(isIndividuallyBuilt('rock')).toBe(false);
    const meshes = buildInstancedProps([placement({ kind: 'house' })]);
    expect(meshes).toHaveLength(0);
  });

  it('groups a multi-part prop (pine) into its constituent parts, one mesh each', () => {
    const meshes = buildInstancedProps([placement({ kind: 'pine' })]);
    // pine() = trunk + 3 foliage cones = 4 distinct meshes.
    expect(meshes).toHaveLength(4);
    for (const m of meshes) expect((m as THREE.InstancedMesh).count).toBe(1);
  });
});
