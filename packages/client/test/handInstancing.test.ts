import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildHandInstancedGroups, type HandPlacement } from '../src/scene/environment/handInstancing.js';
import type { AssetDescriptor } from '../src/scene/assets/types.js';

function twoMeshProp(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 1),
    new THREE.MeshStandardMaterial({ color: '#8a5a33' }),
  );
  trunk.position.y = 0.5;
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(1, 2),
    new THREE.MeshStandardMaterial({ color: '#2f8f4e' }),
  );
  top.position.y = 1.5;
  g.add(trunk, top);
  return g;
}

function placement(overrides: Partial<HandPlacement> = {}): HandPlacement {
  const asset: AssetDescriptor = { kind: 'procedural', build: twoMeshProp };
  return { asset, x: 0, y: 0, rotation: 0, scale: 1, ...overrides };
}

describe('buildHandInstancedGroups', () => {
  it('builds one InstancedMesh per part, shared across placements of the same asset', async () => {
    const groups = await buildHandInstancedGroups([
      placement({ x: 1 }),
      placement({ x: 2 }),
      placement({ x: 3 }),
    ]);
    expect(groups).toHaveLength(2); // trunk + top
    for (const g of groups) expect((g as THREE.InstancedMesh).count).toBe(3);
  });

  it('places instances at the given hand-authored positions', async () => {
    const groups = await buildHandInstancedGroups([placement({ x: 5, y: -3 })]);
    const trunk = groups[0] as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    trunk.getMatrixAt(0, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.x).toBeCloseTo(5);
    expect(pos.z).toBeCloseTo(3); // sim y flips to three -z
  });

  it('applies per-instance tint only when at least one placement requests it', async () => {
    const untinted = await buildHandInstancedGroups([placement(), placement({ x: 1 })]);
    expect((untinted[0] as THREE.InstancedMesh).instanceColor).toBeNull();

    const tinted = await buildHandInstancedGroups([
      placement({ tint: '#ff0000' }),
      placement({ x: 1 }),
    ]);
    expect((tinted[0] as THREE.InstancedMesh).instanceColor).not.toBeNull();
  });

  it('groups distinct assets into their own instanced sets', async () => {
    const otherAsset: AssetDescriptor = {
      kind: 'procedural',
      build: () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()),
    };
    const groups = await buildHandInstancedGroups([
      placement(),
      placement({ asset: otherAsset }),
    ]);
    // twoMeshProp (2 parts) + otherAsset (1 part) = 3 InstancedMeshes total.
    expect(groups).toHaveLength(3);
  });
});
