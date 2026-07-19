```
# Phase 2 – Complete Visual Remake Specification

## Objective

The multiplayer prototype is now complete and functional.

The following systems are considered **production-ready** and should be preserved:

- Authoritative multiplayer server
- Networking
- WebSockets
- Prediction
- Interpolation
- Physics synchronization
- Room management
- Lobby flow
- Game state management
- Input system
- Core gameplay loop

The purpose of this phase is **NOT** to redesign gameplay or networking.

The purpose of this phase is to completely transform the visual presentation so the game feels like a polished commercial-quality indie title.

Everything the player **sees, hears, and experiences visually** should be upgraded while preserving the existing gameplay.

---

# Overall Vision

The game should feel like a modern cooperative driving game with a charming low-poly art style.

Use **Drive Together only as inspiration** for:

- Overall visual quality
- Camera feel
- Low-poly art direction
- Color palette
- Cozy atmosphere
- Playful presentation

Do **NOT** copy:

- Maps
- Roads
- UI
- Vehicles
- Characters
- Branding
- Logos
- Environment layout
- Distinctive assets

The final product should feel original while delivering the same level of charm and polish.

---

# Core Principles

## Do NOT rewrite gameplay.

Do NOT redesign:

- Multiplayer
- Networking
- Prediction
- Interpolation
- Physics synchronization
- Room management
- Game rules

Unless absolutely required.

Gameplay should continue working exactly as it does today.

Everything visual can change.

---

# Rendering

Replace the existing 2D renderer completely.

Use:

- React Three Fiber
- Three.js
- React
- TypeScript

Rendering should become a completely independent module.

The renderer should know **nothing** about networking.

Architecture should look like:

```
Game State
      ↓
Renderer
      ↓
Three.js Scene
```

Networking should simply provide the current state.

The renderer visualizes it.

---

# Graphics

Target style:

- Bright
- Colorful
- Cozy
- Low-poly
- Modern
- Stylized
- Clean
- Readable

Avoid:

- Realism
- Photorealism
- Dark color palettes

The game should immediately feel inviting.

---

# Map Architecture

The current proposal uses a road spline.

Instead, design a more future-proof world description.

Example:

```
World

├── Terrain
├── Road Network
├── Checkpoints
├── Spawn Points
├── Scenery Zones
├── Decorative Objects
├── Future Mission Markers
├── Future NPC Spawns
├── Future AI Routes
├── Metadata
```

The current Willowbrook map may only use one road.

However the architecture should support:

- Multiple roads
- Intersections
- Towns
- Villages
- Large worlds
- Point-to-point journeys
- Open worlds

without redesign.

---

# Road Design

Do NOT procedurally generate road layouts.

Road layouts should be **hand designed**.

The driving experience should be intentionally crafted.

Corners should feel satisfying.

Sightlines should feel natural.

Landmarks should be memorable.

Procedural generation is encouraged for:

- Trees
- Rocks
- Flowers
- Bushes
- Decorative props
- Grass
- Small details

The road itself should be designed manually.

---

# World

The first world will be called

## Willowbrook

Theme:

A cozy countryside.

The player should feel like they are driving through a real place.

Include:

- Village
- Country roads
- Forest
- Lake
- Wooden bridge
- Windmills
- Fields
- Parking lot
- Scenic viewpoints
- Rock tunnel
- Dirt shortcut
- Wooden fences
- Wildflowers
- Pine trees
- Oak trees
- Mountains in distance
- Puffy clouds

The road technically loops.

However it should never feel like a racing circuit.

It should feel like exploring.

---

# Terrain

Gameplay remains physically flat.

However the map format should already support:

- Elevation
- Hills
- Bridges
- Tunnels
- Slopes

for future updates.

The renderer may visually fake distant hills.

Future migration to full 3D terrain should not require redesigning the map system.

---

# Vehicle

Replace the placeholder rectangle.

Use a stylized low-poly car.

Requirements:

- Steering animation
- Wheel rotation
- Suspension movement
- Body roll
- Brake lights
- Reverse lights
- Headlights
- Indicators
- Drift smoke
- Tire skid marks
- Collision sparks

Vehicles should be data-driven.

Even though only one car exists today.

The architecture should support:

- Trucks
- Vans
- Buses
- Tractors
- Special vehicles

without rewriting gameplay.

---

# Characters

Both players should be visible.

Use simple low-poly placeholder characters.

Requirements:

- Capsule/blob style
- Different visual identity
- Slight bounce
- Lean during turns
- Lean during acceleration
- Lean during braking
- Head turns toward steering
- Collision reactions

Implement behind a CharacterRig abstraction.

Future GLTF animated characters should be replaceable without changing gameplay.

---

# Camera

Implement a premium third-person chase camera.

Features:

- Smooth follow
- Camera lag
- Rotation smoothing
- Dynamic distance
- Dynamic FOV
- Collision avoidance
- Camera shake
- Optional cinematic smoothing
- Optional look-back key

The camera should feel responsive while remaining comfortable.

---

# Lighting

Implement:

- HDR environment
- Directional sunlight
- Ambient lighting
- Soft shadows
- Tone mapping
- Ambient Occlusion
- Bloom
- Atmospheric fog

Performance should remain a priority.

---

# Materials

Use proper PBR materials.

Examples:

- Asphalt
- Dirt
- Grass
- Concrete
- Glass
- Metal
- Plastic
- Painted surfaces

Keep materials stylized.

Not realistic.

---

# Sky

Replace the current empty background.

Include:

- HDR sky
- Clouds
- Sun
- Atmospheric fog
- Distant mountains

The world should feel alive.

---

# Environment

Create a believable countryside.

Include:

Road assets

- Asphalt
- Dirt roads
- Sidewalks
- Parking lot

Nature

- Trees
- Bushes
- Rocks
- Flowers
- Grass

Structures

- Houses
- Barns
- Windmills
- Wooden fences
- Bridges
- Street lamps

Props

- Traffic cones
- Benches
- Mailboxes
- Signs
- Hay bales
- Crates

Everything should match the same low-poly style.

---

# Asset Pipeline

Initially:

Procedural low-poly geometry is acceptable.

However every renderable object should be represented through an asset interface.

Example:

```
RenderableAsset

↓

Procedural Mesh

or

GLTF Model
```

This allows replacing placeholder assets later without touching gameplay.

---

# Audio

Add placeholder audio.

Include:

- Engine idle
- Engine acceleration
- Tire skid
- Collision
- Horn
- UI clicks
- Countdown
- Victory sound

Architecture should support future audio replacement.

---

# Effects

Implement:

- Tire smoke
- Dust
- Skid marks
- Collision sparks
- Camera shake
- Speed lines
- Motion blur (subtle)

Effects should be modular.

---

# HUD

Replace debug information.

Create a polished HUD.

Top Left

- Room code
- Players
- Ping

Top Center

- Countdown
- Mission

Bottom Left

- Speedometer
- Gear

Bottom Right

- Controls

Lobby

- Invite code
- Copy link
- Ready button
- Player list
- Connection state

Pause

- Resume
- Settings
- Leave

---

# Performance

Target:

- Stable 60 FPS
- Efficient rendering
- Lazy loading
- Frustum culling
- Geometry batching
- Instancing where appropriate

The game should run smoothly on average laptops.

---

# Architecture

Maintain strict separation between:

```
Networking

Physics

Game Logic

Rendering

UI

Audio

Effects

Assets
```

No gameplay code should depend on rendering.

Rendering visualizes state only.

---

# Code Quality

Every system should be:

- Modular
- Documented
- Extensible
- Typed
- Independently testable

Avoid hacks.

Avoid shortcuts.

Avoid technical debt.

---

# Future Proofing

Everything built today should make future additions straightforward.

Future features include:

- Multiple vehicles
- More maps
- Multiple road networks
- Open world
- Point-to-point journeys
- Missions
- AI traffic
- Weather
- Day/night
- Elevation
- Hills
- Bridges
- Rivers
- Multiplayer progression
- Cosmetics
- Additional game modes

Today's architecture should not block these.

---

# Milestones

## Milestone 1

- Three.js renderer
- New world format
- Chase camera
- Sky
- Ground
- Road
- Placeholder vehicle

Everything playable.

---

## Milestone 2

- Proper vehicle
- Wheel animations
- Characters
- Vehicle animations

---

## Milestone 3

- Willowbrook environment
- Village
- Forest
- Windmills
- Lake
- Tunnel
- Props
- Lighting
- Materials

---

## Milestone 4

- HUD redesign
- Audio
- Effects
- Polish
- Performance optimization
- Deployment

---

# Final Goal

The finished game should feel like a polished commercial-quality browser game rather than a prototype.

Players should immediately notice:

- Smooth multiplayer
- Beautiful visuals
- Excellent camera
- Charming environments
- Responsive controls
- Stable performance
- Clean UI
- Professional presentation

The architecture should be scalable enough to support years of future development without major rewrites.

The primary objective of this phase is to replace the presentation layer while preserving the proven multiplayer foundation already in place.
````

---

# Engineering Addendum (agreed implementation decisions)

This section turns the vision above into concrete, buildable decisions. Where
it narrows something, it narrows scope per milestone — nothing in the vision
is dropped, only sequenced.

## A1. Renderer technology: React Three Fiber (as originally specified)

**Decision (user-confirmed): React + React Three Fiber**, with
@react-three/drei for helpers and @react-three/postprocessing for effects.

Rationale: this is a long-lived project. R3F buys component architecture for
scenes, a large ecosystem (drei, postprocessing, loaders), easier future
menus/HUD/settings as React components, and easier contribution. The
performance delta is negligible for this game.

Integration contract (keeps "renderer knows nothing about networking"):
- The React tree owns the canvas, scene, HUD, lobby, and pause menu.
- Networking (Connection/Predictor/SnapshotBuffer) stays in plain TS modules;
  a thin `useGameClient()` hook exposes their state to React via an external
  store (`useSyncExternalStore`). Per-frame vehicle pose flows through a
  mutable ref sampled in `useFrame` — never through React state (no
  re-renders at 60 fps).
- Gameplay/shared/server code has zero React imports.

## A2. World format (fulfils "Map Architecture" + "Terrain")

One `WorldMap` type in `shared` — the single source both sides consume:

```ts
interface WorldMap {
  name: string;
  seed: number;                          // deterministic scatter
  roads: Road[];                         // network, not a single loop
  spawn: { roadId: string; t: number };  // position along a road
  progress: { mode: 'lap'; roadId: string; gates: number }; // extensible
  zones: Zone[];                         // village | forest | lake | field |
  landmarks: Landmark[];                 //   tunnel | viewpoint | parking
}
interface Road {
  id: string;
  closed: boolean;                       // loop or open segment
  points: { x: number; y: number; z: number; width: number;
            surface: 'paved' | 'dirt' }[];   // z stored now, 0 in phase 2
}
```

- **Hand-designed roads** (per spec): Willowbrook's control points are
  authored by hand in `shared/maps/willowbrook.ts`; procedural generation is
  used only for scatter (trees, rocks, flowers, grass, props).
- `z` (elevation) is stored from day one and ignored by the flat 2D physics —
  future hills need no format change.
- Generators in `shared`: `roadsToWalls(world)` → 2D wall segments for the
  existing planck sim (with junction gaps where roads fork, e.g. the dirt
  shortcut); `roadToGates(world)` → checkpoints for the existing RaceTracker.
- `progress.mode` is a tagged union with one variant today (`lap`);
  point-to-point/missions add variants later without protocol changes.
- Old wall-format maps remain for tests only; the lobby offers Willowbrook.

## A3. Asset & rig abstractions

- `RenderableAsset`: every scenery/vehicle/character factory returns
  `{ object3D: THREE.Object3D }` from a typed descriptor. **The renderer
  natively supports BOTH procedural meshes and GLTF models from day one**:
  each asset descriptor is `{ kind: 'procedural', build: ... }` or
  `{ kind: 'gltf', url: ... }`, resolved by one loader component. Procedural
  and GLTF assets mix freely (procedural trees + GLTF car is a valid scene).
- `VehicleAsset` is data-driven: chassis dimensions, palette, wheel layout,
  light positions come from a `VehicleSpec` object — one spec, named
  **`compact01`** (generic; no real-world vehicle names), ships now;
  trucks/vans later are new specs.
- `CharacterRig` exactly as the spec's Characters section.
- **Asset folder structure** exists from day one, even while mostly empty:

  ```
  packages/client/public/assets/
      models/{vehicles,characters,buildings,props}/
      textures/  sounds/  music/  shaders/  materials/
  ```

- **World streaming readiness:** the renderer groups world content by zone
  into independently mountable chunks, so future larger maps can load/unload
  zones without architectural changes. No streaming is implemented in
  phase 2 — only this grouping.

## A4. Scope tiers (what ships in phase 2 vs. explicitly deferred)

**Must ship (M1–M4):** chase camera (follow, lag, rotation smoothing,
dynamic FOV, shake on collision, look-back key); sun + ambient + soft car
shadow + tone mapping + atmospheric fog; **subtle bloom** (sun + headlights,
via @react-three/postprocessing — cheap, high polish); gradient sky with
procedural clouds and mountain ring; full Willowbrook environment incl.
props (cones, benches, mailboxes, signs, hay bales, crates, lamps, barns);
vehicle with steering / wheel spin / suspension bob / body roll / brake &
reverse lights / headlights; skid marks + tire smoke + dust + collision
sparks; blob characters with all listed reactions; HUD redesign per layout —
speedometer **with gear slot showing "D"** (future-proof for reverse/manual
vehicles: UI never changes), room card, controls card; **minimal pause menu**
(Esc): Resume · Leave Room · Settings (disabled) · Back to Menu; Web-Audio
synth placeholders for engine / skid / collision / horn / UI click; lobby
restyle with copy-link button.

**Deferred (recorded, not built now):** SSAO (revisit after a perf pass on
real laptops); motion blur; HDR .hdr environment textures (gradient sky +
fog achieve the look without asset downloads); turn indicators; functional
settings screen (menu entry ships disabled; needs persisted options first);
countdown/mission HUD slots (rendered as empty regions, wired when modes
exist); ready button (rooms auto-start today — changing that is a gameplay
change, out of phase 2 scope per the spec's own "do not redesign gameplay"
rule); actual zone streaming (grouping only, per A3).

Deferred items get interface hooks where cheap (e.g. the HUD reserves the
top-center slot; the effects module is a registry new effects plug into).

## A5. Materials & lighting reality check

"PBR" is interpreted as `MeshStandardMaterial` with flat vertex colors, low
roughness variation, and no texture maps — stylized, texture-free, tiny
bundle. Tone mapping: ACES filmic. One directional sun with a tight shadow
frustum following the car; hemisphere ambient.

## A6. Testing

- Shared: spline sampling, `roadsToWalls` edge-hugging + junction gaps +
  tight-curve clamping, gate placement, seeded RNG determinism, Willowbrook
  validity (spawn on road, gates ordered, shortcut connects).
- All 47 existing tests pass unchanged.
- Renderer/audio/effects: typecheck + production build + a written manual
  smoke checklist (`docs/smoke-checklist.md`); no WebGL unit tests.

## A7. Milestone mapping (same 4 milestones, tiered)

- **M1 Foundation:** WorldMap format + generators + tests; Willowbrook roads
  authored (layout only); React + R3F app shell replacing the vanilla entry;
  asset folder structure + dual procedural/GLTF asset loader; renderer with
  ground, sky, sun, fog, road mesh, chase camera v1, placeholder box car;
  multiplayer drivable end-to-end.
- **M2 Car & crew:** VehicleSpec compact01 (wheels, suspension, roll,
  lights), CharacterRig blobs with all reactions, camera v2 (shake,
  look-back).
- **M3 World:** all Willowbrook zones + structures + props + scatter,
  grouped by zone (streaming-ready); lighting/material polish + bloom;
  minimap.
- **M4 Presentation & ship:** HUD + lobby redesign (React), pause menu,
  audio synths, effects (skids, smoke, dust, sparks), performance pass
  (instancing, merging, culling verification), deploy, README/plan updates.

