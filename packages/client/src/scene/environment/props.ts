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

const PINE_GREENS = ['#2f8f4e', '#37a55b', '#41b968'];
const OAK_GREENS = ['#4caf50', '#5cbf5f'];

function pine(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.4, 6), '#7a5230', 0.7));
  g.add(mesh(new THREE.ConeGeometry(1.5, 2.4, 7), PINE_GREENS[0]!, 2.3));
  g.add(mesh(new THREE.ConeGeometry(1.1, 1.9, 7), PINE_GREENS[1]!, 3.6));
  g.add(mesh(new THREE.ConeGeometry(0.7, 1.4, 7), PINE_GREENS[2]!, 4.7));
  return g;
}

function oak(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), '#8a5a33', 0.8));
  g.add(mesh(new THREE.IcosahedronGeometry(1.7, 0), OAK_GREENS[0]!, 2.9));
  g.add(mesh(new THREE.IcosahedronGeometry(1.1, 0), OAK_GREENS[1]!, 3.7));
  return g;
}

/** Low rounded shrub cluster — fills gaps between trees, lines paths and yards. */
function bush(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.IcosahedronGeometry(0.55, 0), '#4f9e4a', 0.45));
  const b2 = mesh(new THREE.IcosahedronGeometry(0.4, 0), '#5aad52', 0.4);
  b2.position.x = 0.35;
  g.add(b2);
  const b3 = mesh(new THREE.IcosahedronGeometry(0.35, 0), '#458c42', 0.35);
  b3.position.x = -0.32;
  g.add(b3);
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
let houseCounter = 0;

/** Gable roof (classic triangular-prism). */
function gableRoof(): THREE.Mesh {
  const roof = mesh(new THREE.ConeGeometry(3.4, 1.8, 4), '#a34d3f', 3.5);
  roof.rotation.y = Math.PI / 4;
  return roof;
}

/** Hip roof — a shorter, wider pyramid variant for silhouette variety. */
function hipRoof(): THREE.Mesh {
  const roof = mesh(new THREE.ConeGeometry(3.6, 1.3, 4), '#8a4a52', 3.15);
  roof.rotation.y = Math.PI / 4;
  return roof;
}

const ROOF_BUILDERS = [gableRoof, hipRoof];

/**
 * A small charming cottage: body, one of two roof shapes, chimney, door with
 * a step, two windows with flower boxes. Color palette and roof shape cycle
 * per house so the village doesn't repeat the same building.
 */
function house(): THREE.Object3D {
  const idx = houseCounter++;
  const g = new THREE.Group();
  const bodyColor = HOUSE_COLORS[idx % HOUSE_COLORS.length]!;
  g.add(mesh(new THREE.BoxGeometry(4.2, 2.6, 3.4), bodyColor, 1.3));

  const roof = ROOF_BUILDERS[idx % ROOF_BUILDERS.length]!();
  g.add(roof);

  // Chimney, offset toward the back so it reads against the roof slope.
  const chimney = mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), '#8d8d90', 3.9);
  chimney.position.set(1.2, 0, -0.8);
  g.add(chimney);

  // Door with a small step.
  const door = mesh(new THREE.BoxGeometry(0.8, 1.3, 0.1), '#6b4a2f', 0.65);
  door.position.z = 1.71;
  g.add(door);
  const step = mesh(new THREE.BoxGeometry(1.1, 0.15, 0.4), '#c9c2b4', 0.075);
  step.position.z = 1.9;
  g.add(step);

  // Windows with flower boxes beneath.
  for (const side of [-1, 1]) {
    const win = mesh(new THREE.BoxGeometry(0.7, 0.7, 0.08), '#bfe3ff', 1.6);
    win.position.set(side * 1.1, 0, 1.71);
    g.add(win);
    const box = mesh(new THREE.BoxGeometry(0.8, 0.22, 0.22), '#7a5a3a', 1.18);
    box.position.set(side * 1.1, 0, 1.8);
    g.add(box);
    for (let f = 0; f < 3; f++) {
      const bloom = mesh(
        new THREE.SphereGeometry(0.07, 5, 4),
        FLOWER_COLORS[(idx + f) % FLOWER_COLORS.length]!,
        1.32,
      );
      bloom.position.set(side * 1.1 + (f - 1) * 0.25, 0, 1.82);
      g.add(bloom);
    }
  }
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

/**
 * A distant background silhouette — a tall thin mast with a small red
 * warning light near the top. Breaks up a flat horizon stretch; not meant
 * to ever be driven up to.
 */
function radioMast(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.3, 26, 6), '#9aa3ad', 13));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.08, 26, 4), '#7a828c', 13));
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff2020', emissiveIntensity: 1.4 }),
  );
  light.position.y = 25.6;
  g.add(light);
  return g;
}

/** Build a prop by kind. Houses cycle roof/color/flower palettes. */
export function buildProp(kind: PropKind): THREE.Object3D {
  switch (kind) {
    case 'pine':
      return pine();
    case 'oak':
      return oak();
    case 'bush':
      return bush();
    case 'flower':
      return flower();
    case 'grass':
      return grassTuft();
    case 'rock':
      return rock();
    case 'house':
      return house();
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
    case 'radioMast':
      return radioMast();
  }
}
