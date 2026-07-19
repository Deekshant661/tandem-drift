import * as THREE from 'three';
import type { PropKind } from './scatter.js';

/**
 * Procedural low-poly prop builders. Each returns a THREE.Object3D with its
 * base at y=0. Kept as plain functions (not components) so instanced and
 * merged rendering can reuse the same geometry definitions.
 */

const M = (color: string): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, flatShading: true });

function mesh(geo: THREE.BufferGeometry, color: string, y = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, M(color));
  m.position.y = y;
  m.castShadow = false;
  return m;
}

function pine(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.4, 6), '#7a5230', 0.7));
  g.add(mesh(new THREE.ConeGeometry(1.5, 2.4, 7), '#2f8f4e', 2.3));
  g.add(mesh(new THREE.ConeGeometry(1.1, 1.9, 7), '#37a55b', 3.6));
  g.add(mesh(new THREE.ConeGeometry(0.7, 1.4, 7), '#41b968', 4.7));
  return g;
}

function oak(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), '#8a5a33', 0.8));
  g.add(mesh(new THREE.IcosahedronGeometry(1.7, 0), '#4caf50', 2.9));
  g.add(mesh(new THREE.IcosahedronGeometry(1.1, 0), '#5cbf5f', 3.7));
  return g;
}

export const FLOWER_COLORS = ['#ff7ab6', '#ffd166', '#ff9f68', '#c78bff', '#ff6b6b'];
let flowerCounter = 0;

function flower(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), '#3f9e46', 0.17));
  const c = FLOWER_COLORS[flowerCounter++ % FLOWER_COLORS.length]!;
  g.add(mesh(new THREE.SphereGeometry(0.09, 6, 5), c, 0.38));
  return g;
}

function grassTuft(): THREE.Object3D {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const blade = mesh(new THREE.ConeGeometry(0.05, 0.4, 4), '#63c04f', 0.2);
    blade.position.x = (i - 1) * 0.09;
    blade.rotation.z = (i - 1) * 0.25;
    g.add(blade);
  }
  return g;
}

function rock(): THREE.Object3D {
  return mesh(new THREE.DodecahedronGeometry(0.8, 0), '#9aa3ad', 0.4);
}

export const HOUSE_COLORS = ['#f2b53c', '#e2705d', '#7fb2e5', '#8fd08a', '#e5a8c8', '#d9c79a'];

function house(idx: number): THREE.Object3D {
  const g = new THREE.Group();
  const bodyColor = HOUSE_COLORS[idx % HOUSE_COLORS.length]!;
  g.add(mesh(new THREE.BoxGeometry(4.2, 2.6, 3.4), bodyColor, 1.3));
  const roof = mesh(new THREE.ConeGeometry(3.4, 1.8, 4), '#a34d3f', 3.5);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const door = mesh(new THREE.BoxGeometry(0.8, 1.3, 0.1), '#6b4a2f', 0.65);
  door.position.z = 1.71;
  g.add(door);
  const win1 = mesh(new THREE.BoxGeometry(0.7, 0.7, 0.08), '#bfe3ff', 1.6);
  win1.position.set(-1.1, 1.6, 1.71);
  g.add(win1);
  const win2 = win1.clone();
  win2.position.x = 1.1;
  g.add(win2);
  return g;
}

function fence(): THREE.Object3D {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const post = mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), '#9a7248', 0.45);
    post.position.x = (i - 1) * 1.2;
    g.add(post);
  }
  const rail = mesh(new THREE.BoxGeometry(2.6, 0.1, 0.08), '#a87f52', 0.65);
  g.add(rail);
  const rail2 = rail.clone();
  rail2.position.y = 0.35;
  g.add(rail2);
  return g;
}

function lamp(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 6), '#3d4653', 1.6));
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshStandardMaterial({
      color: '#fff2c0',
      emissive: '#ffdf8a',
      emissiveIntensity: 1.2,
    }),
  );
  head.position.y = 3.3;
  g.add(head);
  return g;
}

function hay(): THREE.Object3D {
  const roll = mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.1, 10), '#d9b45a', 0.8);
  roll.rotation.z = Math.PI / 2;
  return roll;
}

function bench(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), '#9a7248', 0.5));
  const backrest = mesh(new THREE.BoxGeometry(1.6, 0.4, 0.07), '#9a7248', 0.85);
  backrest.position.z = -0.22;
  g.add(backrest);
  for (const x of [-0.7, 0.7]) {
    const leg = mesh(new THREE.BoxGeometry(0.08, 0.5, 0.4), '#5c4530', 0.25);
    leg.position.x = x;
    g.add(leg);
  }
  return g;
}

function mailbox(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5), '#6b4a2f', 0.5));
  g.add(mesh(new THREE.BoxGeometry(0.35, 0.25, 0.5), '#d94f4f', 1.1));
  return g;
}

function crate(): THREE.Object3D {
  return mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), '#b08d57', 0.4);
}

function cone(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 8), '#e8641f', 0.03));
  g.add(mesh(new THREE.ConeGeometry(0.22, 0.55, 8), '#ff7c2a', 0.33));
  return g;
}

let houseCounter = 0;

/** Build a prop by kind. Houses cycle a color palette for a lively village. */
export function buildProp(kind: PropKind): THREE.Object3D {
  switch (kind) {
    case 'pine':
      return pine();
    case 'oak':
      return oak();
    case 'flower':
      return flower();
    case 'grass':
      return grassTuft();
    case 'rock':
      return rock();
    case 'house':
      return house(houseCounter++);
    case 'fence':
      return fence();
    case 'lamp':
      return lamp();
    case 'hay':
      return hay();
    case 'bench':
      return bench();
    case 'mailbox':
      return mailbox();
    case 'crate':
      return crate();
    case 'cone':
      return cone();
  }
}
