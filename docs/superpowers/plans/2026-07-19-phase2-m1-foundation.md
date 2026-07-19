# Phase 2 — Milestone 1 "Foundation" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2D PixiJS client with a React Three Fiber 3D renderer (ground, sky, sun, fog, road mesh, chase camera, placeholder box car) driven by a new shared WorldMap road-network format — multiplayer drivable end-to-end on the new Willowbrook road layout.

**Architecture:** Maps become hand-authored road centerlines in `shared`; one adapter generates the existing `TrackMap` (walls + spawn + checkpoints) for the untouched server/physics/netcode, while the client tessellates the same spline into a 3D road. Networking stays in plain TS (`GameClient` class); React reads it via `useSyncExternalStore`; per-frame pose flows through a mutable ref sampled in `useFrame`.

**Tech Stack:** TypeScript, React 18, @react-three/fiber, @react-three/drei, three, Vite + @vitejs/plugin-react, Vitest. Server/shared unchanged: Node 22, ws, planck.

## Global Constraints

- Do NOT modify server logic, protocol messages, prediction, interpolation, or any file in `packages/server/src` (map registry entry in shared is the only server-visible change).
- All 47 existing tests must keep passing unmodified (except adding new map registry expectations where a test asserts the exact registry key list).
- No real-world vehicle names; the placeholder car spec is `compact01`.
- Renderer code (React/three) must never be imported by `shared` or `server`.
- Asset folder skeleton must exist: `packages/client/public/assets/{models/{vehicles,characters,buildings,props},textures,sounds,music,shaders,materials}` (with `.gitkeep` files).
- Elevation `z` is stored in the format but physics stays flat (z ignored by generators except mesh output).
- Bright/cozy palette; dark backgrounds only in night-free M1 sky gradient bottom fog color `#cfe8ff`-ish tones.

## File Structure (end state of M1)

```
packages/shared/src/
  rng.ts                      # mulberry32 seeded RNG
  world/types.ts              # WorldMap, Road, RoadPoint, Zone, Landmark
  world/spline.ts             # closed Catmull-Rom sampling → RoadSample[]
  world/generate.ts           # wallsFromSamples, gatesFromSamples, worldToTrackMap
  world/willowbrook.ts        # hand-authored Willowbrook WorldMap
  maps/maps.ts                # + willowbrook in PLAYABLE_MAPS, getWorld()
packages/client/src/
  main.tsx                    # React root (replaces main.ts)
  game/client.ts              # GameClient: all networking/game state, poseRef
  game/store.ts               # useGameClient hook (useSyncExternalStore)
  scene/GameCanvas.tsx        # <Canvas> composition + lights + fog + bloomless M1
  scene/ChaseCamera.tsx       # spring-damped chase cam reading poseRef
  scene/Ground.tsx  scene/SkyDome.tsx  scene/RoadMesh.tsx
  scene/Gates.tsx   scene/BoxCar.tsx
  ui/App.tsx  ui/Lobby.tsx  ui/Hud.tsx  ui/styles.css
  (DELETED: main.ts, render/scene.ts, ui/lobby.ts; audio/input/net modules kept)
```

---

### Task 1: Seeded RNG in shared

**Files:**
- Create: `packages/shared/src/rng.ts`
- Modify: `packages/shared/src/index.ts` (add export)
- Test: `packages/shared/test/rng.test.ts`

**Interfaces:**
- Produces: `mulberry32(seed: number): () => number` — deterministic [0,1) generator.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/rng.test.ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/rng.js';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });
  it('differs across seeds and stays in [0,1)', () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run packages/shared/test/rng.test.ts` → FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/rng.ts
/** Deterministic 32-bit PRNG (mulberry32). Same seed → same sequence on
 *  every platform, so scattered scenery matches across clients. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

Add `export * from './rng.js';` to `packages/shared/src/index.ts`.

- [ ] **Step 4: Run test to verify it passes** — same command → PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(shared): mulberry32 seeded RNG"`

---

### Task 2: WorldMap types + closed Catmull-Rom road sampling

**Files:**
- Create: `packages/shared/src/world/types.ts`, `packages/shared/src/world/spline.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/spline.test.ts`

**Interfaces:**
- Produces:
  - Types `WorldMap { name; seed; roads: Road[]; spawn: { roadId; t }; progress: { mode: 'lap'; roadId: string; gates: number }; zones: Zone[]; landmarks: Landmark[] }`,
    `Road { id: string; closed: boolean; points: RoadPoint[] }`,
    `RoadPoint { x; y; z; width; surface: 'paved' | 'dirt' }`,
    `Zone { kind: 'village'|'forest'|'lake'|'field'|'tunnel'|'viewpoint'|'parking'; x; y; radius }`,
    `Landmark { kind: 'windmill'|'bridge'|'mountain'; x; y; rotation: number }`
  - `sampleRoad(road: Road, samplesPerSegment: number): RoadSample[]` where
    `RoadSample { x; y; z; width; surface; tx; ty }` (tx,ty = unit tangent).

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/spline.test.ts
import { describe, expect, it } from 'vitest';
import { sampleRoad } from '../src/world/spline.js';
import type { Road } from '../src/world/types.js';

const square: Road = {
  id: 'main', closed: true,
  points: [
    { x: -50, y: -50, z: 0, width: 8, surface: 'paved' },
    { x: 50, y: -50, z: 0, width: 8, surface: 'paved' },
    { x: 50, y: 50, z: 0, width: 8, surface: 'paved' },
    { x: -50, y: 50, z: 0, width: 8, surface: 'paved' },
  ],
};

describe('sampleRoad', () => {
  it('produces samplesPerSegment × points samples for a closed road', () => {
    expect(sampleRoad(square, 8)).toHaveLength(32);
  });
  it('passes through the control points at segment starts', () => {
    const s = sampleRoad(square, 8);
    expect(s[0]!.x).toBeCloseTo(-50); expect(s[0]!.y).toBeCloseTo(-50);
    expect(s[8]!.x).toBeCloseTo(50);  expect(s[8]!.y).toBeCloseTo(-50);
  });
  it('yields unit tangents that follow travel direction', () => {
    const s = sampleRoad(square, 8);
    for (const p of s) expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 3);
    expect(s[4]!.tx).toBeGreaterThan(0.9); // mid bottom edge heads +x
  });
  it('interpolates width and keeps surface of the segment start', () => {
    const road: Road = { ...square, points: square.points.map((p, i) =>
      i === 1 ? { ...p, width: 16, surface: 'dirt' } : p) };
    const s = sampleRoad(road, 8);
    expect(s[4]!.width).toBeGreaterThan(8);
    expect(s[4]!.width).toBeLessThan(16);
    expect(s[8]!.surface).toBe('dirt');
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/world/types.ts
export interface RoadPoint { x: number; y: number; z: number; width: number;
  surface: 'paved' | 'dirt'; }
export interface Road { id: string; closed: boolean; points: RoadPoint[]; }
export interface Zone { kind: 'village' | 'forest' | 'lake' | 'field' |
  'tunnel' | 'viewpoint' | 'parking'; x: number; y: number; radius: number; }
export interface Landmark { kind: 'windmill' | 'bridge' | 'mountain';
  x: number; y: number; rotation: number; }
export interface WorldMap {
  name: string;
  seed: number;
  roads: Road[];
  spawn: { roadId: string; t: number };
  progress: { mode: 'lap'; roadId: string; gates: number };
  zones: Zone[];
  landmarks: Landmark[];
}
```

```ts
// packages/shared/src/world/spline.ts
import type { Road, RoadPoint } from './types.js';

export interface RoadSample { x: number; y: number; z: number; width: number;
  surface: 'paved' | 'dirt'; tx: number; ty: number; }

function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p2 + p3 - p2) * t3);
}
// NOTE: implementer — use the standard Catmull-Rom basis:
// 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t^2+(-p0+3*p1-3*p2+p3)*t^3)

function crd(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  return 0.5 * ((-p0 + p2) + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
    3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2);
}

/** Sample a closed (or open) Catmull-Rom road. Closed roads wrap neighbor
 *  points; open roads clamp end points. samplesPerSegment ≥ 2. */
export function sampleRoad(road: Road, samplesPerSegment: number): RoadSample[] {
  const pts = road.points;
  const n = pts.length;
  const segs = road.closed ? n : n - 1;
  const at = (i: number): RoadPoint =>
    road.closed ? pts[((i % n) + n) % n]! : pts[Math.min(n - 1, Math.max(0, i))]!;
  const out: RoadSample[] = [];
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < samplesPerSegment; j++) {
      const t = j / samplesPerSegment;
      const x = crPoint(p0.x, p1.x, p2.x, p3.x, t);
      const y = crPoint(p0.y, p1.y, p2.y, p3.y, t);
      const z = crPoint(p0.z, p1.z, p2.z, p3.z, t);
      let dx = crDeriv(p0.x, p1.x, p2.x, p3.x, t);
      let dy = crDeriv(p0.y, p1.y, p2.y, p3.y, t);
      const len = Math.hypot(dx, dy) || 1;
      out.push({ x, y, z, width: p1.width + (p2.width - p1.width) * t,
        surface: p1.surface, tx: dx / len, ty: dy / len });
    }
  }
  return out;
}
```

(Implementer: name the two basis helpers `crPoint`/`crDeriv` with the standard
formulas from the NOTE; the mangled `cr` above is a reminder to use the
canonical basis, not literal code to keep.)

Export both modules from `packages/shared/src/index.ts`:
`export * from './world/types.js'; export * from './world/spline.js';`

- [ ] **Step 4: Run to verify PASS**
- [ ] **Step 5: Commit** — `feat(shared): WorldMap types and Catmull-Rom road sampling`

---

### Task 3: Wall + gate generation and TrackMap adapter

**Files:**
- Create: `packages/shared/src/world/generate.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/generate.test.ts`

**Interfaces:**
- Consumes: `sampleRoad`, `RoadSample`, `WorldMap`, existing `TrackMap`/`WallSegment`/`Checkpoint` from `maps/types.js`.
- Produces:
  - `wallsFromSamples(samples: RoadSample[], closed: boolean): WallSegment[]` — left+right edge walls.
  - `gatesFromSamples(samples: RoadSample[], count: number): Checkpoint[]` — evenly spaced by sample index, radius = 1.5 × local width.
  - `worldToTrackMap(world: WorldMap, samplesPerSegment?: number): TrackMap` — walls from the progress road, spawn at `spawn.t` along it facing the tangent, checkpoints from `progress.gates`.

- [ ] **Step 1: Failing test**

```ts
// packages/shared/test/generate.test.ts
import { describe, expect, it } from 'vitest';
import { sampleRoad } from '../src/world/spline.js';
import { wallsFromSamples, gatesFromSamples, worldToTrackMap } from '../src/world/generate.js';
import type { Road, WorldMap } from '../src/world/types.js';

const circle: Road = {
  id: 'main', closed: true,
  points: Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x: Math.cos(a) * 60, y: Math.sin(a) * 60, z: 0, width: 8,
      surface: 'paved' as const };
  }),
};
const world: WorldMap = {
  name: 'testworld', seed: 7, roads: [circle],
  spawn: { roadId: 'main', t: 0 },
  progress: { mode: 'lap', roadId: 'main', gates: 6 },
  zones: [], landmarks: [],
};

describe('wallsFromSamples', () => {
  it('creates two closed wall rings offset by the road width', () => {
    const samples = sampleRoad(circle, 6);
    const walls = wallsFromSamples(samples, true);
    expect(walls).toHaveLength(samples.length * 2);
    // Every wall endpoint sits near radius 60±8 from the origin.
    for (const w of walls) {
      const r = Math.hypot(w.x1, w.y1);
      expect(Math.abs(r - 60)).toBeGreaterThan(6);
      expect(Math.abs(r - 60)).toBeLessThan(10);
    }
  });
});

describe('gatesFromSamples', () => {
  it('places ordered gates on the centerline with width-scaled radius', () => {
    const samples = sampleRoad(circle, 6);
    const gates = gatesFromSamples(samples, 6);
    expect(gates).toHaveLength(6);
    for (const g of gates) {
      expect(Math.hypot(g.x, g.y)).toBeCloseTo(60, 0);
      expect(g.radius).toBeCloseTo(12, 1);
    }
  });
});

describe('worldToTrackMap', () => {
  it('produces a playable TrackMap: spawn on road, facing tangent', () => {
    const tm = worldToTrackMap(world);
    expect(tm.name).toBe('testworld');
    expect(Math.hypot(tm.spawn.x, tm.spawn.y)).toBeCloseTo(60, 0);
    expect(tm.walls.length).toBeGreaterThan(50);
    expect(tm.checkpoints).toHaveLength(6);
    // spawn.angle must equal atan2 convention used by the sim:
    // vehicle forward is +y rotated by angle → angle = atan2(-tx, ty)… see impl note.
  });
});
```

- [ ] **Step 2: FAIL** (module not found)

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/world/generate.ts
import type { Checkpoint, TrackMap, WallSegment } from '../maps/types.js';
import type { WorldMap } from './types.js';
import { sampleRoad, type RoadSample } from './spline.js';

/** Left/right normal of a sample: normal = (-ty, tx). */
function edges(s: RoadSample): { lx: number; ly: number; rx: number; ry: number } {
  const nx = -s.ty, ny = s.tx;
  return { lx: s.x + nx * s.width, ly: s.y + ny * s.width,
           rx: s.x - nx * s.width, ry: s.y - ny * s.width };
}

export function wallsFromSamples(samples: RoadSample[], closed: boolean): WallSegment[] {
  const walls: WallSegment[] = [];
  const last = closed ? samples.length : samples.length - 1;
  for (let i = 0; i < last; i++) {
    const a = edges(samples[i]!);
    const b = edges(samples[(i + 1) % samples.length]!);
    walls.push({ x1: a.lx, y1: a.ly, x2: b.lx, y2: b.ly });
    walls.push({ x1: a.rx, y1: a.ry, x2: b.rx, y2: b.ry });
  }
  return walls;
}

export function gatesFromSamples(samples: RoadSample[], count: number): Checkpoint[] {
  const gates: Checkpoint[] = [];
  for (let g = 0; g < count; g++) {
    const s = samples[Math.floor((g / count) * samples.length)]!;
    gates.push({ x: s.x, y: s.y, radius: s.width * 1.5 });
  }
  return gates;
}

/** Adapter: the entire server/physics side consumes a WorldMap through this. */
export function worldToTrackMap(world: WorldMap, samplesPerSegment = 8): TrackMap {
  const road = world.roads.find((r) => r.id === world.progress.roadId)!;
  const samples = sampleRoad(road, samplesPerSegment);
  const spawnSample = samples[Math.floor(world.spawn.t * samples.length) % samples.length]!;
  return {
    name: world.name,
    // Vehicle forward is local +y; getWorldVector(0,1) rotated by angle a is
    // (-sin a, cos a). We need that to equal (tx, ty) → a = atan2(-tx, ty).
    spawn: { x: spawnSample.x, y: spawnSample.y,
             angle: Math.atan2(-spawnSample.tx, spawnSample.ty) },
    walls: wallsFromSamples(samples, road.closed),
    checkpoints: gatesFromSamples(samples, world.progress.gates),
  };
}
```

Export from index: `export * from './world/generate.js';`

- [ ] **Step 4: PASS**
- [ ] **Step 5: Commit** — `feat(shared): road→walls/gates generators and WorldMap→TrackMap adapter`

---

### Task 4: Willowbrook world + registry + drive-through validation

**Files:**
- Create: `packages/shared/src/world/willowbrook.ts`
- Modify: `packages/shared/src/maps/maps.ts` (register), `packages/shared/src/index.ts`
- Test: `packages/shared/test/willowbrook.test.ts`
- Modify: `packages/shared/test/race.test.ts` (registry key list assertion gains `willowbrook`)

**Interfaces:**
- Produces: `willowbrook(): WorldMap` (hand-authored); `getWorld(name: string): WorldMap | null` in maps.ts; `PLAYABLE_MAPS.willowbrook` returns `worldToTrackMap(willowbrook())`; `DEFAULT_MAP = 'willowbrook'`.

- [ ] **Step 1: Failing test**

```ts
// packages/shared/test/willowbrook.test.ts
import { describe, expect, it } from 'vitest';
import { willowbrook } from '../src/world/willowbrook.js';
import { worldToTrackMap } from '../src/world/generate.js';
import { getMap, getWorld } from '../src/maps/maps.js';
import { createSimWorld, stepSim, snapshotVehicle, NEUTRAL_INPUT, SIM_DT } from '../src/index.js';

describe('willowbrook world', () => {
  it('is registered and adapts to a TrackMap', () => {
    expect(getWorld('willowbrook')?.name).toBe('willowbrook');
    expect(getMap('willowbrook').name).toBe('willowbrook');
    expect(getWorld('track01')).toBeNull(); // legacy maps have no world
  });
  it('has one closed main road with sensible geometry', () => {
    const w = willowbrook();
    const main = w.roads[0]!;
    expect(main.closed).toBe(true);
    expect(main.points.length).toBeGreaterThanOrEqual(16);
    for (const p of main.points) {
      expect(p.width).toBeGreaterThanOrEqual(5);
      expect(p.width).toBeLessThanOrEqual(12);
      expect(p.z).toBe(0);
    }
  });
  it('spawns the car on the road and lets it drive without instant collision', () => {
    const tm = worldToTrackMap(willowbrook());
    const sim = createSimWorld(tm);
    for (let i = 0; i < 180; i++) {
      stepSim(sim, { ...NEUTRAL_INPUT, throttle: 1 }, SIM_DT);
    }
    const s = snapshotVehicle(sim);
    // 3 s of full throttle from spawn on a straight must reach real speed —
    // if the spawn faced a wall we'd be slow or stuck.
    expect(Math.hypot(s.vx, s.vy)).toBeGreaterThan(8);
  });
  it('zones and landmarks cover the required areas', () => {
    const w = willowbrook();
    const kinds = new Set(w.zones.map((z) => z.kind));
    for (const k of ['village', 'forest', 'lake', 'field', 'parking'] as const) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(w.landmarks.filter((l) => l.kind === 'windmill').length).toBeGreaterThanOrEqual(2);
    expect(w.landmarks.some((l) => l.kind === 'bridge')).toBe(true);
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement.** Author the road by hand — a rounded organic loop
roughly 400×260 m with a long lakeside straight (SE), a village cluster (NW),
forest S-curves (NE), field sweep (SW). Starting layout (tune freely while
keeping tests green):

```ts
// packages/shared/src/world/willowbrook.ts
import type { WorldMap } from './types.js';

/** Hand-authored countryside loop. Coordinates in meters, origin at map
 *  center. Gameplay is flat: all z = 0 in Phase 2 (format supports more). */
export function willowbrook(): WorldMap {
  const paved = (x: number, y: number, width = 8) =>
    ({ x, y, z: 0, width, surface: 'paved' as const });
  return {
    name: 'willowbrook',
    seed: 20260719,
    roads: [{
      id: 'main', closed: true,
      points: [
        // village approach & main street (NW quadrant)
        paved(-140, 60, 9), paved(-100, 95, 9), paved(-50, 110, 9),
        // north meadow curve toward forest
        paved(10, 118, 8), paved(70, 105, 7),
        // forest S-curves (NE)
        paved(115, 75, 7), paved(95, 40, 7), paved(135, 10, 7),
        // lakeside straight heading south (E edge) + bridge over inlet
        paved(150, -40, 8), paved(140, -85, 8),
        // southern shore bend
        paved(100, -115, 8), paved(40, -125, 8),
        // field sweep (SW) past windmills
        paved(-30, -118, 9), paved(-90, -95, 9),
        // west climb to viewpoint bend
        paved(-135, -55, 8), paved(-150, 0, 8),
      ],
    }],
    spawn: { roadId: 'main', t: 0.02 },
    progress: { mode: 'lap', roadId: 'main', gates: 10 },
    zones: [
      { kind: 'village', x: -95, y: 85, radius: 55 },
      { kind: 'parking', x: -60, y: 70, radius: 18 },
      { kind: 'forest', x: 115, y: 55, radius: 60 },
      { kind: 'lake', x: 105, y: -60, radius: 45 },
      { kind: 'field', x: -55, y: -105, radius: 60 },
      { kind: 'viewpoint', x: -148, y: -30, radius: 20 },
    ],
    landmarks: [
      { kind: 'bridge', x: 146, y: -62, rotation: 1.35 },
      { kind: 'windmill', x: -55, y: -85, rotation: 0.5 },
      { kind: 'windmill', x: -10, y: -100, rotation: 2.1 },
      { kind: 'mountain', x: 0, y: 420, rotation: 0 },
    ],
  };
}
```

In `maps.ts`: import `willowbrook` + `worldToTrackMap`; add
`willowbrook: () => worldToTrackMap(willowbrook())` to `PLAYABLE_MAPS`; set
`DEFAULT_MAP = 'willowbrook'`; add
`export function getWorld(name: string): WorldMap | null { return name === 'willowbrook' ? willowbrook() : null; }`.
Update `race.test.ts` registry assertion to `['track01', 'track02', 'willowbrook']`.
If the drive-through test fails, widen the spawn-area road or move `spawn.t`
to the middle of the longest straight — do not weaken the assertion.

- [ ] **Step 4: `npx vitest run` — ALL tests pass (existing + new).**
- [ ] **Step 5: Commit** — `feat(shared): Willowbrook world, registered as default playable map`

---

### Task 5: Client React scaffold (deps, Vite, entry, asset folders)

**Files:**
- Modify: `packages/client/package.json`, `packages/client/vite.config.ts`, `packages/client/tsconfig.json`, `packages/client/index.html`
- Create: `packages/client/src/main.tsx`, `packages/client/src/ui/App.tsx`, `packages/client/src/ui/styles.css`, asset folder `.gitkeep`s
- Delete: nothing yet (old main.ts stays until Task 7 wires everything)

**Interfaces:**
- Produces: React root rendering `<App/>`; `App` renders `<h1>Tandem Drift</h1>` placeholder this task only (replaced in Task 7).

- [ ] **Step 1: Add dependencies**

In `packages/client/package.json` dependencies add:
`"react": "^18.3.1", "react-dom": "^18.3.1", "three": "^0.169.0", "@react-three/fiber": "^8.17.10", "@react-three/drei": "^9.114.3"`;
devDependencies add: `"@vitejs/plugin-react": "^4.3.4", "@types/react": "^18.3.12", "@types/react-dom": "^18.3.1", "@types/three": "^0.169.0"`.
Run `npm install` at repo root.

- [ ] **Step 2: Configure**

`vite.config.ts`: `import react from '@vitejs/plugin-react';` and add `plugins: [react()],`.
`tsconfig.json` compilerOptions add: `"jsx": "react-jsx"`.
`index.html`: body becomes `<div id="root"></div><script type="module" src="/src/main.tsx"></script>`; move existing inline `<style>` content into `src/ui/styles.css` (imported by main.tsx) — keep the CSS rules verbatim for now.

- [ ] **Step 3: Entry + placeholder App**

```tsx
// packages/client/src/main.tsx
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.js';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(<App />);
```

```tsx
// packages/client/src/ui/App.tsx
export function App(): JSX.Element {
  return <h1>Tandem Drift</h1>;
}
```

Create asset skeleton with `.gitkeep`s:
`packages/client/public/assets/models/{vehicles,characters,buildings,props}/.gitkeep`,
`packages/client/public/assets/{textures,sounds,music,shaders,materials}/.gitkeep`.

- [ ] **Step 4: Verify** — `npm run typecheck` clean (old main.ts still compiles; it's no longer referenced by index.html); `npm run build -w @tandem/client` succeeds; `npx vitest run` all pass.
- [ ] **Step 5: Commit** — `feat(client): React scaffold, Vite react plugin, asset folder structure`

---

### Task 6: GameClient — networking state extracted from main.ts

**Files:**
- Create: `packages/client/src/game/client.ts`, `packages/client/src/game/store.ts`
- Test: `packages/client/test/gameClient.test.ts`

**Interfaces:**
- Consumes: existing `Connection`, `SnapshotBuffer`, `Predictor`, `KeyboardInput`, `EngineAudio`, protocol types.
- Produces:

```ts
interface GameState {
  phase: 'lobby' | 'connecting' | 'playing' | 'disconnected' | 'error';
  errorText: string | null;
  roomCode?: string; role: Role | null; players: PlayerInfo[];
  race?: RaceInfo; rttMs: number; speedKmh: number; swapPending: boolean;
  mapName: string | null;
}
class GameClient {
  readonly poseRef: { current: VehicleSnapshot | null }; // mutated at frame rate
  getState(): GameState;                    // stable snapshot object
  subscribe(fn: () => void): () => void;    // for useSyncExternalStore
  join(opts: { name: string; roomCode?: string; map: string }): void;
  requestSwap(): void;
  samplePose(nowMs: number): void;          // predictor/interp → poseRef
}
function useGameClient(client: GameClient): GameState; // in store.ts
```

- [ ] **Step 1: Failing test** (state machine only — no sockets; inject a fake Connection factory)

```ts
// packages/client/test/gameClient.test.ts
import { describe, expect, it, vi } from 'vitest';
import { GameClient } from '../src/game/client.js';
import type { ServerMsg } from '@tandem/shared';

function fakeConnFactory() {
  const handlers: { open?: () => void; msg?: (m: ServerMsg) => void } = {};
  const conn = {
    rttMs: 42, sent: [] as unknown[],
    onOpen: (f: () => void) => { handlers.open = f; },
    onClose: (_f: () => void) => {},
    onMessage: (f: (m: ServerMsg) => void) => { handlers.msg = f; },
    send: (m: unknown) => conn.sent.push(m),
  };
  return { conn, handlers };
}

describe('GameClient state machine', () => {
  it('lobby → connecting → playing on joined', () => {
    const { conn, handlers } = fakeConnFactory();
    const gc = new GameClient({ createConnection: () => conn as never });
    const listener = vi.fn();
    gc.subscribe(listener);
    expect(gc.getState().phase).toBe('lobby');

    gc.join({ name: 'Ann', map: 'willowbrook' });
    expect(gc.getState().phase).toBe('connecting');
    handlers.open!();
    expect(conn.sent[0]).toMatchObject({ type: 'join', name: 'Ann', map: 'willowbrook' });

    handlers.msg!({ type: 'joined', roomCode: 'ABCDEF', playerId: 'p', role: 'pilot',
      tick: 0, token: 'tok', map: 'willowbrook' });
    const s = gc.getState();
    expect(s.phase).toBe('playing');
    expect(s.role).toBe('pilot');
    expect(s.mapName).toBe('willowbrook');
    expect(listener).toHaveBeenCalled();
  });

  it('getState returns the same reference until something changes', () => {
    const { conn } = fakeConnFactory();
    const gc = new GameClient({ createConnection: () => conn as never });
    expect(gc.getState()).toBe(gc.getState());
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement `GameClient`** by porting main.ts logic verbatim
(join/reconnect with sessionStorage token, roomState, seatSwapped, snapshot →
SnapshotBuffer + Predictor + race/speed state, input interval at
`INPUT_SEND_HZ`, HUD-refresh interval replaced by state emissions, audio
start on keydown). Constructor takes
`{ createConnection?: (url: string) => Connection }` for testability,
defaulting to `new Connection(SERVER_URL)`. Every state mutation goes through
a private `setState(partial)` that rebuilds the state object and notifies
subscribers (cache the object so unchanged getState() is referentially
stable). `samplePose(now)` sets
`poseRef.current = predictor?.sample() ?? snapshots.sample(now)`.
`store.ts`:

```ts
// packages/client/src/game/store.ts
import { useSyncExternalStore } from 'react';
import type { GameClient } from './client.js';
export function useGameClient(client: GameClient) {
  return useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.getState(),
  );
}
```

- [ ] **Step 4: PASS** (new test + all existing)
- [ ] **Step 5: Commit** — `feat(client): GameClient networking store decoupled from rendering`

---

### Task 7: R3F scene — sky, ground, road, gates, box car, chase camera; App wiring

**Files:**
- Create: `packages/client/src/scene/GameCanvas.tsx`, `SkyDome.tsx`, `Ground.tsx`, `RoadMesh.tsx`, `Gates.tsx`, `BoxCar.tsx`, `ChaseCamera.tsx`
- Modify: `packages/client/src/ui/App.tsx` (lobby → game flow), `packages/client/src/ui/styles.css`
- Create: `packages/client/src/ui/Lobby.tsx`, `packages/client/src/ui/Hud.tsx`

**Interfaces:**
- Consumes: `GameClient` + `useGameClient`, `getWorld`, `sampleRoad`.
- Produces: `<GameCanvas client={gc} world={WorldMap}/>`. Coordinate mapping (fixed convention for ALL scene code): world sim (x, y) → three (x, 0, -y); heading angle a → three rotationY = a. Car pose ref sampled per frame.

- [ ] **Step 1: Components** (complete code)

```tsx
// packages/client/src/scene/GameCanvas.tsx
import { Canvas } from '@react-three/fiber';
import type { WorldMap } from '@tandem/shared';
import type { GameClient } from '../game/client.js';
import { SkyDome } from './SkyDome.js';
import { Ground } from './Ground.js';
import { RoadMesh } from './RoadMesh.js';
import { Gates } from './Gates.js';
import { BoxCar } from './BoxCar.js';
import { ChaseCamera } from './ChaseCamera.js';

export function GameCanvas({ client, world }: { client: GameClient; world: WorldMap }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 60, near: 0.5, far: 900 }}
      style={{ position: 'fixed', inset: 0 }}>
      <color attach="background" args={['#aee2ff']} />
      <fog attach="fog" args={['#cfe8ff', 120, 650]} />
      <ambientLight intensity={0.55} color="#eaf6ff" />
      <directionalLight position={[120, 180, 60]} intensity={1.6} color="#fff4d6"
        castShadow shadow-mapSize={[1024, 1024]} />
      <SkyDome />
      <Ground />
      <RoadMesh world={world} />
      <Gates client={client} world={world} />
      <BoxCar client={client} />
      <ChaseCamera client={client} />
    </Canvas>
  );
}
```

```tsx
// packages/client/src/scene/SkyDome.tsx — gradient dome + horizon mountains
import { useMemo } from 'react';
import * as THREE from 'three';

export function SkyDome() {
  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#5fb8ff') },
                bottom: { value: new THREE.Color('#dff1ff') } },
    vertexShader: `varying float h; void main(){ h = normalize(position).y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying float h; uniform vec3 top; uniform vec3 bottom;
      void main(){ gl_FragColor = vec4(mix(bottom, top, clamp(h*1.6, 0.0, 1.0)), 1.0); }`,
  }), []);
  const mountains = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const R = 700;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const a2 = ((i + 0.5) / 26) * Math.PI * 2;
      const peak = 60 + ((i * 137) % 70);
      verts.push(Math.cos(a) * R, 0, Math.sin(a) * R,
                 Math.cos(a2) * R, peak, Math.sin(a2) * R,
                 Math.cos((i + 1) / 26 * Math.PI * 2) * R, 0,
                 Math.sin((i + 1) / 26 * Math.PI * 2) * R);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);
  return (
    <group>
      <mesh material={skyMat}><sphereGeometry args={[820, 24, 12]} /></mesh>
      <mesh geometry={mountains}>
        <meshStandardMaterial color="#7f9bb8" flatShading />
      </mesh>
    </group>
  );
}
```

```tsx
// packages/client/src/scene/Ground.tsx
export function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.05} receiveShadow>
      <circleGeometry args={[750, 48]} />
      <meshStandardMaterial color="#7ec850" />
    </mesh>
  );
}
```

```tsx
// packages/client/src/scene/RoadMesh.tsx — ribbon from spline samples
import { useMemo } from 'react';
import * as THREE from 'three';
import { sampleRoad, type WorldMap } from '@tandem/shared';

export function RoadMesh({ world }: { world: WorldMap }) {
  const { paved, edges } = useMemo(() => {
    const road = world.roads[0]!;
    const s = sampleRoad(road, 12);
    const pos: number[] = []; const idx: number[] = [];
    const n = s.length;
    for (let i = 0; i < n; i++) {
      const p = s[i]!; const nx = -p.ty, ny = p.tx;
      // sim (x,y) → three (x, 0, -y)
      pos.push(p.x + nx * p.width, 0, -(p.y + ny * p.width));
      pos.push(p.x - nx * p.width, 0, -(p.y - ny * p.width));
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2, b = ((i + 1) % n) * 2;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    // Edge lines: two slightly-raised white strips reuse the same samples.
    const edgeGeo = new THREE.BufferGeometry();
    const epos: number[] = [];
    for (const off of [0.92, -0.92]) {
      for (let i = 0; i <= n; i++) {
        const p = s[i % n]!; const nx = -p.ty, ny = p.tx;
        epos.push(p.x + nx * p.width * off, 0.02, -(p.y + ny * p.width * off));
      }
    }
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(epos, 3));
    return { paved: geo, edges: edgeGeo };
  }, [world]);
  return (
    <group>
      <mesh geometry={paved} receiveShadow position-y={0.01}>
        <meshStandardMaterial color="#5a5f6b" />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#ffffff" />
      </lineSegments>
    </group>
  );
}
```

```tsx
// packages/client/src/scene/Gates.tsx — floating ring at the active gate only
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { worldToTrackMap, type WorldMap } from '@tandem/shared';
import type { GameClient } from '../game/client.js';

export function Gates({ client, world }: { client: GameClient; world: WorldMap }) {
  const ref = useRef<THREE.Mesh>(null);
  const gates = worldToTrackMap(world).checkpoints;
  useFrame(({ clock }) => {
    const i = client.getState().race?.nextCheckpoint ?? -1;
    const m = ref.current; if (!m) return;
    if (i < 0 || !gates[i]) { m.visible = false; return; }
    m.visible = true;
    m.position.set(gates[i]!.x, 2.2 + Math.sin(clock.elapsedTime * 2) * 0.4, -gates[i]!.y);
    m.rotation.y = clock.elapsedTime * 0.8;
  });
  return (
    <mesh ref={ref} rotation-x={Math.PI / 2}>
      <torusGeometry args={[3.2, 0.28, 10, 32]} />
      <meshStandardMaterial color="#34d399" emissive="#0f8a5f" emissiveIntensity={0.7} />
    </mesh>
  );
}
```

```tsx
// packages/client/src/scene/BoxCar.tsx — placeholder until M2 compact01
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameClient } from '../game/client.js';

export function BoxCar({ client }: { client: GameClient }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, __) => {
    client.samplePose(performance.now());
    const p = client.poseRef.current; const g = ref.current;
    if (!p || !g) return;
    g.position.set(p.x, 0, -p.y);
    g.rotation.y = p.angle; // sim angle: +y forward, CCW; matches three Y-up with z=-y
  });
  return (
    <group ref={ref}>
      <mesh castShadow position-y={0.55}>
        <boxGeometry args={[1.8, 0.7, 4.0]} />
        <meshStandardMaterial color="#e0484d" />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0.3]}>
        <boxGeometry args={[1.5, 0.45, 1.7]} />
        <meshStandardMaterial color="#f9e3e0" />
      </mesh>
    </group>
  );
}
```

```tsx
// packages/client/src/scene/ChaseCamera.tsx — spring-damped follow
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameClient } from '../game/client.js';

export function ChaseCamera({ client }: { client: GameClient }) {
  const cur = useRef(new THREE.Vector3(0, 20, 30));
  const look = useRef(new THREE.Vector3());
  useFrame(({ camera }, dt) => {
    const p = client.poseRef.current; if (!p) return;
    const speed = Math.hypot(p.vx, p.vy);
    const back = 9 + Math.min(4, speed * 0.12);         // dynamic distance
    const fwdX = -Math.sin(p.angle), fwdZ = -Math.cos(p.angle); // three-space forward
    const target = new THREE.Vector3(
      p.x - fwdX * back, 4.2 + speed * 0.03, -p.y - fwdZ * back);
    const k = 1 - Math.exp(-dt * 4);                    // frame-rate independent
    cur.current.lerp(target, k);
    camera.position.copy(cur.current);
    const ahead = new THREE.Vector3(
      p.x + fwdX * (4 + speed * 0.15), 1.2, -p.y + fwdZ * (4 + speed * 0.15));
    look.current.lerp(ahead, 1 - Math.exp(-dt * 6));
    camera.lookAt(look.current);
    const cam = camera as THREE.PerspectiveCamera;
    const targetFov = 60 + Math.min(12, speed * 0.35);  // dynamic FOV
    cam.fov += (targetFov - cam.fov) * k; cam.updateProjectionMatrix();
  });
  return null;
}
```

**Forward-vector note for the implementer:** sim forward is
`(-sin a, cos a)` in sim-(x,y). Mapping (x,y)→(x,−y) gives three-space
forward `(-sin a, -( cos a))` → `fwdX = -Math.sin(a)`, `fwdZ = -Math.cos(a)`,
and `rotation.y = a` renders the box aligned. If the car visually drives
backward relative to the camera, flip the sign on `back` — assert correctness
by driving with W: the camera must sit behind the car's motion.

- [ ] **Step 2: App wiring — port Lobby and Hud to React**

`Lobby.tsx`: controlled form (name, map select with `track01|track02|willowbrook`
labels, room-code input, Create/Join buttons) calling
`client.join({name, map, roomCode?})`; skip lobby when URL has `?room=`
(same logic as old `runLobby`). `Hud.tsx`: renders the same lines the old
`renderHud` produced, from `useGameClient(client)` state — keep the existing
CSS classes so styles.css applies. `App.tsx`:

```tsx
// packages/client/src/ui/App.tsx
import { useMemo } from 'react';
import { GameClient } from '../game/client.js';
import { useGameClient } from '../game/store.js';
import { getWorld } from '@tandem/shared';
import { GameCanvas } from '../scene/GameCanvas.js';
import { Lobby } from './Lobby.js';
import { Hud } from './Hud.js';

export function App() {
  const client = useMemo(() => new GameClient({}), []);
  const state = useGameClient(client);
  const world = state.mapName ? getWorld(state.mapName) : null;
  return (
    <>
      {state.phase === 'lobby' && <Lobby client={client} />}
      {state.phase === 'playing' && world && <GameCanvas client={client} world={world} />}
      {state.phase === 'playing' && !world && <FallbackNotice />}
      <Hud client={client} />
    </>
  );
}
function FallbackNotice() {   // legacy maps (track01/02) have no 3D world yet
  return <div className="notice">This room plays a legacy 2D map — create a Willowbrook room to see the 3D world.</div>;
}
```

- [ ] **Step 3: Verify manually** — `npm run dev:server` + `npm run dev:client`; two tabs; drive the loop; camera follows; active gate ring visible; laps count.
- [ ] **Step 4: `npm run typecheck` + `npx vitest run` + build all green.**
- [ ] **Step 5: Commit** — `feat(client): R3F 3D scene — sky, road, chase camera, box car, React lobby/HUD`

---

### Task 8: Remove PixiJS + dead code, deploy

**Files:**
- Delete: `packages/client/src/main.ts`, `packages/client/src/render/scene.ts`, `packages/client/src/ui/lobby.ts`
- Modify: `packages/client/package.json` (remove `pixi.js`)

**Steps:**
- [ ] Delete files; `npm install` (lockfile update); grep repo for `pixi` → zero hits outside lockfile history.
- [ ] `npm run typecheck && npx vitest run && npm run build -w @tandem/client` — all green.
- [ ] Manual smoke once more (two tabs, drive, lap, seat swap Tab, reconnect by killing server briefly).
- [ ] Commit `feat(client): remove PixiJS 2D renderer` and push; verify GitHub Actions CI + Pages deploy succeed; server on Render needs no redeploy (shared map registry travels inside the server image on next Render auto-deploy from main — confirm Render redeployed, since DEFAULT_MAP changed).
- [ ] Verify production: open the Pages URL, create a room, see the 3D world.

---

## Self-Review Notes

- Spec coverage (M1 scope in phase2.md §A7): WorldMap format+generators+tests (Tasks 1–4), Willowbrook layout (Task 4), R3F shell (Task 5), asset folders + dual asset loading *readiness* (folders in Task 5; the GLTF/procedural `RenderableAsset` interface lands in M2 with the first real assets — M1 has no assets to load), renderer with ground/sky/sun/fog/road/camera/box car (Task 7), multiplayer end-to-end (Tasks 7–8). Bloom/pause/HUD-redesign are M3/M4 per §A4/§A7.
- Type consistency: `GameState.mapName` feeds `getWorld`; `worldToTrackMap` output feeds existing `createSimWorld` unchanged; coordinate convention documented once (GameCanvas comment + Task 7 note).
- No placeholders: every task has real code; Task 2's basis-formula NOTE directs to the canonical Catmull-Rom formula explicitly.
