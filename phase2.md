# Phase 2 Spec — Tandem Drift 3D: the "Willowbrook" update

Date: 2026-07-19 · Status: **approved design, ready for implementation planning**

## Goal

Transform the client from a top-down 2D debug view into a charming 3D
chase-camera experience competitive with Drive Together on the web — while
changing **nothing** about the proven multiplayer core (authoritative server,
planck.js physics, prediction, interpolation, rooms, laps).

Original art identity: bright low-poly countryside. Explicitly **avoid**
Japanese-inspired architecture, cherry blossoms, pagodas, or anything that
reads as Drive Together's visual identity.

## Non-goals (this phase)

- No 3D physics: the drivable world is a flat plane. Rolling hills exist only
  beyond the road as scenery. (Full 3D physics with slopes is a possible
  Phase 3.)
- No skeletal character rigs, no external 3D asset files, no asset pipeline.
- No gameplay changes: laps/checkpoints stay, seat roles stay, netcode stays.

## Decisions already made

| Decision | Choice |
|---|---|
| 3D depth | 3D visuals over the existing flat 2D authoritative sim |
| Renderer | Three.js (mature standard; client-only dependency) |
| Art | Procedural low-poly meshes, vertex colors, zero external assets |
| Theme | Original bright countryside ("Willowbrook"), NOT sakura/pagoda |
| Characters | Visible from MVP: capsule/blob riders behind a swappable interface |
| Map shape | Closed loop that *feels* like a real place, not a race circuit |
| Determinism | Seeded procedural scatter → both players see the identical world |

## Architecture

### 1. Rendering stack

`packages/client/src/render/scene.ts` (PixiJS) is replaced by a Three.js
`Renderer3D` behind the same narrow interface main.ts already uses:

```ts
init(map: TrackMap): Promise<void>
update(pose: VehicleSnapshot, dtMs: number): void   // dt added for animation
setActiveGate(index: number): void
```

Netcode, Predictor, SnapshotBuffer, lobby, and HUD logic are untouched.
PixiJS is removed from dependencies.

### 2. Shared map format v2 — road splines

A v2 map is authored as a **road centerline**, not walls:

```ts
interface RoadMap {
  name: string;
  seed: number;                     // deterministic scenery scatter
  points: RoadPoint[];              // closed Catmull-Rom loop
  checkpointEvery?: number;         // auto-place N gates along the loop
  zones: Zone[];                    // annotations: village | forest | lake |
}                                   //   bridge | field | tunnel | viewpoint |
                                    //   shortcut | parking
interface RoadPoint {
  x: number; y: number;             // centerline position (meters, 2D plane)
  width: number;                    // road half-width at this point
  surface: 'paved' | 'dirt';
}
```

From this **single source** in `shared`:
- `roadToWalls(map)` → 2D wall segments along both road edges → fed to the
  existing `createSimWorld` (server physics + client prediction). Gaps are
  left where the dirt shortcut forks off.
- `roadToCheckpoints(map)` → evenly spaced gates on the centerline → existing
  `RaceTracker`, unchanged.
- The client tessellates the same spline into the 3D road mesh.

Old wall-format maps (`arenaMap`, track01/02) keep working for tests; the
lobby switches to Willowbrook as the default map.

**Progress abstraction:** `RaceTracker` already sits behind a small surface
(`update(x, y, tick)` / `state(tick)`). Phase 2 formalizes this as a
`ProgressTracker` interface so a later phase can swap laps for point-to-point
journeys or missions without touching rooms or protocol.

### 3. The world: Willowbrook

One main loop (~2.5× current track length) connecting, in order:
1. **Village** — 8–12 colorful gabled houses, parking area, fences
2. **Forest road** — dense stylized pines + oaks closing in on the road
3. **Lakeside** — lake on one side, wooden bridge over an inlet
4. **Open fields** — wildflowers, tall grass tufts, 2–3 windmills (spinning)
5. **Tunnel** — short rock-formation tunnel (visual arch; walls from map)
6. **Viewpoint bend** — elevated-feeling scenic curve (visual berm)
7. **Dirt shortcut** — narrower dirt fork cutting a corner (risk/reward)

Horizon ring of low-poly mountains, puffy cartoon clouds (slow drift), bright
blue sky with warm directional sun, distant rolling green hills. Rivers feed
the lake as flat blue ribbons under bridges.

### 4. Car & characters

- **Car:** open-top low-poly chassis built from vertex-colored primitives;
  4 wheels that spin with speed and steer with input (front pair).
- **Characters:** `CharacterRig` interface — inputs `(seat, pose: {speed,
  steer, throttle, brake, collision})` → per-frame transforms for a small set
  of named parts (body, head). MVP implementation: capsule/blob riders.
  - Distinct identity: pilot gold cap accent, engineer green scarf accent.
  - Animations: speed-scaled bounce, lean into corners & braking, pilot head
    turns toward steering, collision jolt (triggered by frame-to-frame
    velocity spikes in snapshots).
  - Future-proof: replacing the rig implementation with modeled characters
    requires no gameplay-code changes.

### 5. Camera

Smoothed chase camera: positioned behind & above the car (spring-damped),
velocity-based look-ahead, subtle FOV widening with speed, gentle lag on
turns. Spectators get the same camera.

### 6. HUD

Same information (room code, role, partner, speed, ping, laps, swap), same
DOM approach, restyled as a compact rounded cozy card + a small SVG minimap
of the loop with a live car dot.

### 7. Performance & quality

- Target 60 fps on modest laptops.
- All static scenery merged into few draw calls (BufferGeometry merge per
  material group); instanced meshes for trees/flowers/fence posts.
- One directional light + ambient; soft shadow map only for the car;
  distance fog for depth and draw-distance masking.
- Seeded RNG (mulberry32) in `shared` for all scatter placement.

### 8. Testing

- Unit (shared): spline sampling; `roadToWalls` (walls hug road edges at
  correct offsets, closed loop, shortcut gaps well-formed);
  `roadToCheckpoints` (on centerline, ordered, evenly spaced); seeded RNG
  determinism; Willowbrook map validity (spawn on road, gates on road).
- Existing 47 tests keep passing unmodified (sim, netcode, rooms, predictor).
- Client 3D layer: typecheck + production build + manual smoke (documented
  checklist); no WebGL unit tests.

### 9. Milestones (each compiles, tests pass, deployable)

- **3D-1 Foundation:** map format v2 + generators + tests; Three.js renderer
  with ground, sky, sun, road mesh from spline, chase cam, placeholder box
  car; Willowbrook centerline authored; drivable end-to-end in multiplayer.
- **3D-2 Car & crew:** real low-poly car with wheels; CharacterRig + blob
  riders with all listed animations.
- **3D-3 World:** full Willowbrook scenery set (village, forest, lake,
  bridges, windmills, tunnel, viewpoint, shortcut, fences, rocks, mountains,
  clouds); HUD restyle + minimap.
- **3D-4 Polish & ship:** fog tuning, collision reactions, performance pass,
  deploy to GitHub Pages + Render, update README/plan.md.

## Risks & mitigations

- **Wall generation artifacts** (self-intersections on tight curves): clamp
  curvature vs. road width in the generator; unit-test tight-curve cases.
- **Bundle growth** (Three.js ≈ 150 kB gz): acceptable; PixiJS is removed.
- **Perf on low-end** : instancing + merged geometry from day one; fog-capped
  draw distance.
- **Art quality risk** (procedural meshes look crude): vertex-color palette
  discipline + consistent proportions; iterate on the village/tree/windmill
  generators until screenshots look charming.

## Future (Phase 3+ candidates, enabled by this design)

- Point-to-point journeys / missions via `ProgressTracker` swap.
- Modeled + animated characters via `CharacterRig` swap.
- Real elevation: Rapier 3D server sim (the big one).
- More worlds: new `RoadMap` + palette + scenery mix per theme.
- Binary protocol codec behind the existing `encode/decode` seam.
