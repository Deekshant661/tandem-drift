import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AssetDescriptor, RenderableAsset } from './types.js';

const gltfLoader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();

/**
 * Resolve any asset descriptor to an Object3D. GLTF results are cached by URL
 * and cloned per call so multiple instances can share one download.
 */
export async function loadAsset(desc: AssetDescriptor): Promise<RenderableAsset> {
  if (desc.kind === 'procedural') {
    return { object3D: desc.build() };
  }
  let cached = cache.get(desc.url);
  if (!cached) {
    cached = gltfLoader.loadAsync(desc.url).then((g) => g.scene);
    cache.set(desc.url, cached);
  }
  const scene = await cached;
  return { object3D: scene.clone(true) };
}
