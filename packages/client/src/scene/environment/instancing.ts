import * as THREE from 'three';
import { buildProp, FLOWER_COLORS } from './props.js';
import type { PropKind, Placement } from './scatter.js';

interface PartTemplate {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Transform of this mesh relative to the prop's own origin. */
  localMatrix: THREE.Matrix4;
}

/** Flatten a procedurally-built prop into its constituent meshes' geometry,
 *  material, and local transform — generic across any prop's internal
 *  composition (single mesh or nested group). */
export function flattenTemplate(obj: THREE.Object3D): PartTemplate[] {
  obj.updateMatrixWorld(true);
  const parts: PartTemplate[] = [];
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      parts.push({
        geometry: child.geometry,
        material: child.material as THREE.Material,
        // obj itself has identity transform, so matrixWorld here is the
        // mesh's transform relative to the prop's own origin.
        localMatrix: child.matrixWorld.clone(),
      });
    }
  });
  return parts;
}

/** Compose a placement's world transform with a part's local offset. */
export function composeInstanceMatrix(
  placement: Pick<Placement, 'x' | 'y' | 'rotation' | 'scale'>,
  localMatrix: THREE.Matrix4,
): THREE.Matrix4 {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(placement.x, 0, -placement.y),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, placement.rotation, 0)),
    new THREE.Vector3(placement.scale, placement.scale, placement.scale),
  );
  return m.multiply(localMatrix);
}

/** Kinds rendered individually (few in number, high per-instance variety). */
const NOT_INSTANCED: ReadonlySet<PropKind> = new Set(['house']);

/**
 * Build one InstancedMesh per (kind, mesh-part) covering every placement of
 * that kind — turns hundreds of individual draw calls (one per tree/flower/
 * fence post) into a handful of GPU-instanced ones. Static scenery, so
 * matrices are written once; frustumCulled is disabled per mesh since
 * InstancedMesh doesn't expand its bounding volume to cover scattered
 * instances (a single draw call regardless, so culling buys little here).
 */
export function buildInstancedProps(placements: Placement[]): THREE.Object3D[] {
  const byKind = new Map<PropKind, Placement[]>();
  for (const p of placements) {
    if (NOT_INSTANCED.has(p.kind)) continue;
    const list = byKind.get(p.kind) ?? [];
    list.push(p);
    byKind.set(p.kind, list);
  }

  const result: THREE.Object3D[] = [];
  const tmpMatrix = new THREE.Matrix4();
  const tmpColor = new THREE.Color();

  for (const [kind, list] of byKind) {
    const parts = flattenTemplate(buildProp(kind));
    parts.forEach((part, partIndex) => {
      const isFlowerBloom = kind === 'flower' && partIndex === parts.length - 1;
      const count = list.length;
      const instMesh = new THREE.InstancedMesh(part.geometry, part.material.clone(), count);
      instMesh.frustumCulled = false;
      instMesh.castShadow = false;
      instMesh.receiveShadow = false;
      if (isFlowerBloom) {
        instMesh.instanceColor = new THREE.InstancedBufferAttribute(
          new Float32Array(count * 3),
          3,
        );
      }
      list.forEach((placement, i) => {
        tmpMatrix.copy(composeInstanceMatrix(placement, part.localMatrix));
        instMesh.setMatrixAt(i, tmpMatrix);
        if (isFlowerBloom) {
          tmpColor.set(FLOWER_COLORS[i % FLOWER_COLORS.length]!);
          instMesh.setColorAt(i, tmpColor);
        }
      });
      instMesh.instanceMatrix.needsUpdate = true;
      if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
      result.push(instMesh);
    });
  }
  return result;
}

/** Prop kinds that stay individually built (used by Environment). */
export function isIndividuallyBuilt(kind: PropKind): boolean {
  return NOT_INSTANCED.has(kind);
}
