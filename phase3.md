# Phase 3 Spec — "Fernvale": a handcrafted showcase drive

Date: 2026-07-19 · Status: **approved design, ready for implementation planning**

## Goal

Stop adding gameplay systems. Build one small (~800m), exceptional, handcrafted
road that makes players want to drive around even with no objective — using
real CC0 low-poly assets (Kenney primary) composed with intention, not
procedural scatter. Willowbrook is untouched and remains the regression/test
map. Multiplayer, recovery, physics, and audio are frozen unless something
here blocks them (it shouldn't — this is a client-only, additive map).

## Non-goals (explicitly out of scope this phase)

- No new gameplay systems, protocol messages, or server changes.
- No generalized terrain engine — the heightfield is a single-purpose
  function for this one map, not a reusable editor.
- No real-time water simulation — one attractive, simple animated lake.
- No replacing the player vehicle with a real asset (stays procedural
  `compact01`; only its *scale* may be tuned against the new surroundings).
- No large-scale asset flooding — composition and negative space over prop
  count, everywhere.

## Design philosophy (from direction feedback)

**One believable place, not eight zones.** Village gradually becomes
farmland, farmland gradually becomes forest, forest opens toward the lake.
Every atmospheric property (fog, ambient tint, vegetation density, palette)
is a continuous function of *distance along the road*, blended with wide
transition bands — never a hard cut between "themed sections." Internally
we still track named **character waypoints** (Village, Farmland, Forest,
Lakeside, Windmill Fields) purely as control points for that continuous
blend, and a short list of **named landmarks** for player orientation — but
nothing in the built world should read as a discrete "zone."

**The road is the star.** More design effort goes into the corner sequence
than into prop placement. The loop mixes: tight corners, sweeping bends,
short straights, narrow sections, open sections, and elevation *illusions*
(hillside cuttings, a rise toward a lookout) that never require the flat
physics to actually climb.

**Negative space is deliberate.** Sky, lake, and mountains need room to
read. Fewer, well-placed objects beat filled space — Willowbrook's
seeded-scatter density is explicitly *not* the model here.

**Landmarks for orientation, not decoration.** A short, named list of
one-of-a-kind features players will recall and use to navigate: a
distinctive oversized windmill, a red covered bridge, a lakeside dock, a
hilltop lookout, one large oak tree, and a small church/clock tower visible
on a distant skyline (not necessarily reachable — a silhouette landmark).

**Ambient life, cheap.** Small, GPU-cheap animated touches — windmill
blades, gentle tree sway, water ripple, a few distant birds, drifting
leaves, chimney smoke, butterflies/fireflies where fitting. All either
shader-driven (a single time uniform, zero CPU cost) or a handful of
instances (never per-frame CPU work across hundreds of objects) — this
phase follows directly after a performance-fix milestone and must not
regress it.

## Architecture

### 1. Road & map: `packages/shared/src/world/fernvale.ts`

A new hand-authored `WorldMap` (same format Phase 2 built: road centerline,
zones, landmarks) — reuses `worldToTrackMap`, `RaceTracker`, and the entire
server/physics/prediction stack completely unchanged. Registered in
`PLAYABLE_MAPS` as `fernvale`, selectable in the lobby alongside Willowbrook
and the legacy 2D maps. Once it reaches the intended quality it becomes
`DEFAULT_MAP`; until then Willowbrook stays default so regression testing
is unaffected. Road control points are chosen by hand for the corner
sequence, not generated.

Rough sequence (final coordinates are a build-time concern, not fixed
here): village start → farmland transition → tight 90° corner with flower
beds → red covered bridge over a stream → road narrows into forest → forest
opens toward the lake (dock, lookout climb) → long sweeping right-hander →
windmill fields → gradual return to village.

### 2. Terrain: `packages/client/src/scene/terrain/heightfield.ts`

One pure function `terrainHeight(x, y): number` for Fernvale only:
- **Exactly 0** within the road corridor (centerline to road-width + a fixed
  margin) — the visual ground can never contradict the flat physics.
- Blends via smoothstep from 0 at the corridor edge to full authored height
  over a *generous* falloff distance (no "wall of dirt" appearing right at
  the tires) — chosen specifically so the road never visually appears to
  climb even though nearby terrain does.
- A short authored list of features (hills, one valley, one cliff edge as a
  signed-distance drop) plus light multi-octave noise for micro-variation.
- Consumed once in a `useMemo` by a heightmapped ground mesh (reasonable
  grid resolution, one draw call, vertex-colored — no per-frame cost,
  matching the existing Ground/RoadMesh pattern).

This is intentionally the only new "system" in this phase, and it stays
scoped to exactly this: a height function plus a mesh, not a terrain editor.

### 3. Continuous atmosphere: `packages/client/src/scene/environment/fernvaleAtmosphere.ts`

`atmosphereAt(t: number): { fogColor, fogNear, fogFar, ambientTint,
vegetationDensity, paletteBias }` — smoothly interpolates between the
named character waypoints (by arc-length fraction along the road) using
wide overlapping falloffs, the same raised-cosine style windowing already
used for the engine-audio crossfade. No consumer ever sees a hard switch;
subtle is the explicit target, not a biome change.

### 4. Hand-placed scenery: `packages/client/src/scene/environment/fernvaleScenery.ts`

Explicit, authored placements (not seeded random scatter) for repeated
elements (tree clusters, fence runs, flower beds), with local density
driven by `atmosphereAt` — thinning out deliberately to leave negative
space around the lake and open field stretches. Named landmarks (windmill,
bridge, dock, lookout, oak, distant church/clock tower) are placed
individually, once each, at hand-picked coordinates.

### 5. Real assets

Sourced primarily from Kenney (CC0), gap-filled from Quaternius/Poly Pizza
only where Kenney lacks a fit — landing in the already-scaffolded
`packages/client/public/assets/models/{vehicles,characters,buildings,props}`.
Every asset is visually checked against its neighbors before mass-placement;
anything that looks out of place is adjusted (recolored/rescaled) or
swapped rather than forced in. A small in-app credits line acknowledges
Kenney as a courtesy (not legally required under CC0).

The existing `RenderableAsset`/`flattenTemplate` pipeline is extended so a
template can resolve from an async-loaded glTF (cached by URL) as well as
from a procedural builder — real and procedural pieces share one
instancing path with no special-casing at the call site.

### 6. Vehicle scale check

No vehicle asset changes, but `compact01`'s scale is checked (and tuned,
likely bumped slightly) against Fernvale's real-asset proportions —
target is a deliberately toy-like, slightly oversized car, matching the
cozy arcade feel, not realistic 1:1 scale against the new buildings.

### 7. Water

One lake: a gently animated shader (shimmer/ripple via a time-driven normal
perturbation and a soft specular highlight) — no real-time reflections or
simulation. Cheap, static geometry, one material.

### 8. Ambient life: `packages/client/src/scene/environment/AmbientLife.tsx`

- Windmill blades: already animated (Phase 2), reused.
- Tree sway: a small vertex-shader offset driven by one time uniform on the
  foliage material — GPU-only, zero added CPU/instance cost.
- Water ripple: shader time uniform on the lake material.
- Distant birds: a handful (single digits) of simple animated shapes on
  looping paths in the sky.
- Drifting leaves / butterflies / fireflies: small pooled instance counts
  (tens, not hundreds), fitted to the appropriate part of the drive
  (fireflies near the forest/lake at the shaded end, butterflies near the
  flower beds).
- Chimney smoke: a few small soft particle puffs above village houses,
  reusing the existing pooled-particle approach from the effects system.

## Testing

- `heightfield.test.ts`: height is exactly 0 on and immediately around the
  road centerline at multiple sampled points; rises correctly at an
  authored hill location; the cliff drop is monotonic and matches its
  authored position.
- `fernvale.test.ts`: same map-validity shape as Willowbrook's existing
  tests (registered, adapts to a `TrackMap`, spawn on road, drivable via a
  physics smoke test, gates ordered).
- `fernvaleAtmosphere.test.ts`: interpolation is continuous (no
  discontinuities at waypoint boundaries), monotonically approaches each
  waypoint's values near its own position, and stays within valid ranges
  everywhere.
- No server tests needed — nothing server-side changes.
- Visual quality (composition, "does this actually look good") is verified
  by the user playing it; I'll call out any rough spots I can't fully
  self-assess rather than claim polish I can't see.

## Risks

- **Asset availability is discovered, not guaranteed in advance** — exact
  Kenney kit contents (e.g. a dock/boat model) vary; I'll substitute
  procedurally or from a secondary CC0 source where needed and say so
  plainly rather than force a poor fit.
- **Heightfield could visually fight the flat physics if under-tuned** —
  mitigated by the hard 0-at-corridor rule and a generous falloff distance,
  verified by driving the full loop and checking for any apparent grade at
  the road edge.
- **Ambient life could reintroduce the per-frame performance regression
  fixed last phase** — mitigated by keeping all of it shader-driven or
  tiny-instance-count, never per-object CPU updates at scale.

## Future (beyond this phase)

- Expand Fernvale beyond this one stretch once the quality bar is met, or
  use it as the template for additional maps.
- Consider promoting Fernvale to `DEFAULT_MAP` once validated.
- Real vehicle/character assets, deferred per this phase's explicit scope.
