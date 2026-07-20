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
than into prop placement — designed by hand, not generated mathematically,
and never a string of repetitive S-curves. The loop includes, each once and
each for a reason: one memorable hairpin, one fast sweeping corner, one
blind-crest illusion, one technical chicane, one long relaxing straight,
one scenic overlook, and one narrow bridge approach — plus elevation
*illusions* (hillside cuttings, a rise toward a lookout) that never require
the flat physics to actually climb.

**Road width varies with place, not just decoration varies with place.**
Wider through the village; narrow at the bridge crossing; slightly
narrower through the forest; wide again at the lakeside scenic stretch;
narrow at the technical corners; wide through the open farmland sweepers.
Subtle, continuous (same blending approach as the atmosphere function),
and never so narrow it hurts gameplay readability.

**The road surface itself has quiet variation**, not just a flat asphalt
color: subtle patched-asphalt tone variation, gently faded lane markings
(more faded on long-unused stretches), gravel shoulders blending to dirt
blending to grass, and grass creeping slightly at the road's edge.
Believable wear, not damage.

**Camera composition is a placement input, not an afterthought.** Corners
and landmarks are placed with the chase camera's framing in mind —
driving toward the sunset on the long straight, the road briefly framed by
trees before the bridge, the lake revealed coming out of the sweeper, the
distant windmill appearing over the rise into the fields. The chase camera
should produce a "postcard" moment on a regular cadence through the lap,
not by accident.

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

**Ambient audio follows the same continuous blend as everything else** —
no music, nothing loud, just soft area-appropriate sound that fades in/out
with `atmosphereAt`: distant birds and soft wind near the village, insects
and birds in the forest, water and wind at the lake, wind and windmill
creaks in the fields. An extension of the existing `AudioManager`
crossfade approach, not a new audio system.

**No visible repetition.** Every repeated placement (trees, fence posts,
flower clumps) gets randomized rotation, slight scale jitter, and a touch
of color-tint variation — the instancing pipeline already does exactly
this for Willowbrook's foliage (Phase 2's per-instance HSL jitter); Fernvale's
hand-placed repeats reuse the same mechanism rather than placing identical
clones.

**Environmental storytelling, not random props.** A handful of small,
specific vignettes rather than generic scatter: a bicycle leaned against a
house, a parked tractor at the farmland edge, a picnic bench by the lake, a
stacked woodpile, a flower-filled mailbox. Each placed once, on purpose.

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

### 7a. Lighting as a defining character

Not just "warm lighting" — a warm, late-afternoon golden-hour treatment is
the single biggest lever for making Fernvale instantly recognizable from
one screenshot: long soft shadows, rich warm sky color, gentle contrast.
Builds on Phase 2's directional-light/hemisphere/bloom setup — tuned
harder toward golden-hour specifically for this map (Willowbrook keeps its
current midday treatment; per-map lighting is just different prop values
to the same `GameCanvas`, no new system).

### 7b. Ambient audio: extends `packages/client/src/audio/manager.ts`

Same continuous-blend mechanism as the visual atmosphere (§3), applied to a
small set of soft area-appropriate loops (birds/wind/village bell; forest
insects/birds; lake water/wind; field wind/windmill creak) — never music,
never loud, crossfaded by `atmosphereAt`'s position exactly like the
existing engine-band crossfade.

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
- Working name "Fernvale" is a placeholder; a more distinctive name (e.g.
  Bramble Valley, Pine Hollow, Clover Ridge) is worth adopting once the map
  proves out — not blocking this phase.
