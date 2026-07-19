import type * as THREE from 'three';

/**
 * Every renderable thing (vehicles, characters, buildings, props) is created
 * from a descriptor so procedural placeholders can later be replaced with
 * GLTF models without touching gameplay code. Both kinds mix freely in a
 * scene (procedural trees + GLTF car is a valid combination).
 */
export type AssetDescriptor =
  | { kind: 'procedural'; build: () => THREE.Object3D }
  | { kind: 'gltf'; url: string };

export interface RenderableAsset {
  object3D: THREE.Object3D;
}
