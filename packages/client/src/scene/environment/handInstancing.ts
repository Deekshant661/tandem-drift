import * as THREE from 'three';
import { loadAsset } from '../assets/loadAsset.js';
import type { AssetDescriptor } from '../assets/types.js';
import { composeInstanceMatrix, flattenTemplate, type PartTemplate } from './instancing.js';

/**
 * A single hand-authored placement of a real (glTF) or procedural asset.
 * Unlike Willowbrook's seeded scatter, these come from an explicit list —
 * every entry is a deliberate choice, not a random draw.
 */
export interface HandPlacement {
  asset: AssetDescriptor;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  /** Per-instance tint (recolor a shared model) — used to break up visible
   *  repetition (Kenney's single grass/flower models reused many times). */
  tint?: string;
}

/**
 * Shared clock for wind sway — one write per frame (see WindClock.tsx)
 * feeds every swaying material's shader uniform by reference, so animating
 * hundreds of tree/bush/flower/grass instances costs nothing per-instance:
 * it's a single GPU vertex-shader displacement, not a CPU matrix update.
 */
export const windTime = { value: 0 };

const SWAYABLE_PATTERN = /tree_|plant_|flower_|grass_/i;

/** Inject a cheap per-instance wind displacement into a material's vertex
 *  shader. Uses each instance's own transform as a phase offset so a grove
 *  of trees doesn't wave in perfect unison. */
function applyWindSway(material: THREE.Material): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.vertexShader = `uniform float uWindTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float windPhase = uWindTime * 1.6 + (instanceMatrix[3].x + instanceMatrix[3].z) * 0.35;
      float windSway = sin(windPhase) * 0.05 * clamp(transformed.y, 0.0, 3.0);
      transformed.x += windSway;
      transformed.z += windSway * 0.6;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'wind-sway';
}

function keyOf(desc: AssetDescriptor): string {
  return desc.kind === 'gltf' ? `gltf:${desc.url}` : `proc:${desc.build.toString().slice(0, 40)}`;
}

const templateCache = new Map<string, Promise<PartTemplate[]>>();

async function resolveTemplate(desc: AssetDescriptor): Promise<PartTemplate[]> {
  const key = keyOf(desc);
  let cached = templateCache.get(key);
  if (!cached) {
    cached = loadAsset(desc).then((a) => flattenTemplate(a.object3D));
    templateCache.set(key, cached);
  }
  return cached;
}

/**
 * Build one InstancedMesh per (asset, mesh-part) across every placement that
 * shares that asset — the same GPU-instancing win as Willowbrook's scatter
 * system, but driven by an explicit hand-authored list instead of random
 * placement, and able to mix real glTF models with procedural ones.
 */
export async function buildHandInstancedGroups(
  placements: HandPlacement[],
): Promise<THREE.Object3D[]> {
  const byAsset = new Map<string, HandPlacement[]>();
  for (const p of placements) {
    const key = keyOf(p.asset);
    const list = byAsset.get(key) ?? [];
    list.push(p);
    byAsset.set(key, list);
  }

  const result: THREE.Object3D[] = [];
  const tmpMatrix = new THREE.Matrix4();
  const tmpColor = new THREE.Color();

  for (const [assetKey, list] of byAsset) {
    // A single missing/broken model must never blank out the rest of the
    // scene — isolate failures per asset instead of letting one rejected
    // fetch kill the whole batch (this exact failure mode is what made
    // every real-asset placement in Fernvale invisible after a path bug).
    let parts;
    try {
      parts = await resolveTemplate(list[0]!.asset);
    } catch (err) {
      console.error(`[fernvale] failed to load asset for placement group "${assetKey}":`, err);
      continue;
    }
    const swayable = SWAYABLE_PATTERN.test(assetKey);
    for (const part of parts) {
      const count = list.length;
      const material = part.material.clone();
      if (swayable) applyWindSway(material);
      const mesh = new THREE.InstancedMesh(part.geometry, material, count);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const hasTint = list.some((p) => p.tint);
      if (hasTint) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      }
      const baseColor =
        (part.material as THREE.MeshStandardMaterial).color?.clone() ?? new THREE.Color('#ffffff');
      list.forEach((placement, i) => {
        tmpMatrix.copy(composeInstanceMatrix(placement, part.localMatrix));
        mesh.setMatrixAt(i, tmpMatrix);
        if (hasTint) {
          tmpColor.set(placement.tint ?? `#${baseColor.getHexString()}`);
          mesh.setColorAt(i, tmpColor);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      result.push(mesh);
    }
  }
  return result;
}
