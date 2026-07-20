# Phase 4 Spec — "Soul" (First Impression)

Date: 2026-07-20 · Status: **approved design, ready for implementation**

## Goal

Not more assets. Not more systems. Not more props. The only objective:
**every 10-15 seconds of driving produces a memorable view.** If a screenshot
taken at any random point in the first minute looks boring, this phase isn't
finished. Client-only (visual/placement), no shared/server/gameplay changes.

## Non-goals

- No new maps, no new gameplay systems, no networking/physics changes.
- No "add more trees" as a solution to emptiness — every placement must
  answer "why is this here?" or it gets removed.
- Audio layering and camera-feel refinement are explicitly deferred to a
  follow-up phase; this pass is visual composition only.

## 0. Bugs (mandatory, fixed regardless of everything else)

- **The lake overlaps the drivable road** — confirmed from a screenshot: the
  car drove onto the water and got stuck (0 km/h, recovery prompt). The
  decorative `FernvaleLake` mesh has no relationship to the road's actual
  walls; its position/radius must be re-derived from the real geometry so it
  sits believably beside the corridor, never across it, with a real
  shoreline transition.
- No floating props, no obviously broken terrain (already improved last
  phase; re-verify against the new lake geometry).

## 1. Compose the drive, not the world

The wrong question is "where should trees go?" The right one is "what does
the player see exiting this corner?" Fernvale's road was already hand-authored
in Phase 3 with named intent per point (tight corner, bridge, blind crest,
hairpin, lake reveal, sweeper, chicane, straight) — this phase uses that
existing semantic knowledge directly, rather than generic algorithmic
placement: for each named moment, a specific reveal is staged **ahead of the
car along the road's own tangent**, positioned like an environment artist
would frame a shot, not scattered by radius-jitter around a point.

Reveals, one per major corner/straight (not exhaustive prose here — exact
coordinates are an implementation detail, staged relative to each existing
road point's position + tangent):

- Village exit → farmland: the hero oak + a color-accent flower patch appear
  ahead, framing the transition.
- Tight 90° corner: flower beds visible mid-corner, framed by fence lines
  either side of the road (already partially placed — recomposed to sit
  exactly in the sightline exiting the apex, not just "nearby").
- Bridge approach: the red covered bridge is visible from further back than
  currently (a "there it is" reveal, not a surprise at the last meter).
- Blind crest into forest: tree canopy visibly closes in ahead of the crest,
  not just once inside it.
- Forest hairpin: framed by dense tree walls both sides so the tight turn
  reads as "squeezing through," not "turning in open ground."
- Lake reveal: the single biggest reveal in the lap — water, dock, canoe,
  and the far shoreline should all become visible together as the road
  opens, per the existing "lakeside" atmosphere waypoint, now with a real
  shoreline (see §0) instead of a lake the road drives through.
- Fast sweeper: the cliff feature (already authored, now properly bounded)
  visible on the outside of the corner.
- Windmill fields: the oversized windmill visible well before reaching it,
  a rising anticipation shot, not a pop-in.
- Long straight: sunset-facing framing (already true given lighting
  direction) plus the distant church/tower silhouette visible ahead.

## 2. Believable skyline

The horizon must (almost) never be a flat line. Currently one flat hill
silhouette. Replace with layered, varied peaks (already has two ridge layers
from Phase 2's `SkyDome` — reused, not rebuilt) plus at least two **background
silhouette landmarks** beyond the drivable area: the distant church/tower
(already exists, repositioned to actually be visible from more of the lap,
not just the village) and one more (a second distant windmill or a radio-mast
silhouette) placed to break up the flattest remaining stretch (the long
straight/fields area).

## 3. Color composition

Not randomly colorful — **one dominant accent color per stretch**, an
intentional focal point:
- Village: white/colorful house cluster (already varied via `HOUSE_COLORS`,
  recomposed to be in-frame from the spawn point, not just nearby).
- Tight corner: yellow/red flower bed (already placed — verified in-frame).
- Farmland: warm gold crop rows (already placed — recomposed for visibility).
- Forest: dark pine green, deliberately the "cool, dim" contrast stretch.
- Lake: blue water against green shoreline.
- Windmill fields: golden field + white windmill.

## 4. Frame views

Trees, fences, rocks, and hills flank the road at key points instead of
sitting in a generic radius-jittered ring — the player should rarely look
into flat, empty grass with nothing at the frame edges. This is largely a
side effect of §1's reveal-based placement (things placed to be *seen*
naturally sit at the frame edges) rather than a separate system.

## 5. Landmark rhythm

A distinct landmark or color-accent focal point roughly every 15-25 seconds
of driving (not a timer — a consequence of the reveal placements in §1 being
spread across the ~758m loop at a pace matching typical corner-to-corner
driving time at this game's speeds).

## Art direction principle

Every landmark, skyline silhouette, the lake, the bridge, the village
entrance, and viewpoints are positioned as if staged for the camera by an
environment artist — using the road's own tangent/position as the staging
reference, not a placement algorithm's output, even where helper code (jitter,
instancing) does the mechanical work underneath.

## Success metrics (measurable, not vibes)

- The first minute of driving contains 5-8 visually distinct "postcard"
  moments (a corner/straight where something specific and recognizable is
  in frame, not generic scenery).
- No view in the first minute is dominated by empty flat grass with nothing
  at the frame edges.
- Every major corner reveals a new focal point exiting it.
- The skyline is broken by a distant silhouette from most points on the lap,
  never a flat line for an extended stretch.
- A screenshot taken at any random moment in the first minute has a clear
  subject that draws the eye immediately.

## Testing

- The lake-fix is testable numerically: the water's boundary must never
  overlap the road's actual wall geometry (a distance check against
  `wallsFromSamples` output), same rigor as the scenery-clear-of-road test
  already in place.
- Composition/framing itself is not something a unit test can verify — it
  will be checked by node-position math (confirming each staged reveal sits
  within a reasonable "ahead of car, near road" cone at its intended road
  position) plus your own visual review, since I cannot render or screenshot
  the scene myself. I'll be explicit about what I can and can't self-verify.

## Risks

- I cannot see the rendered result. Every placement decision here is
  reasoned from road geometry and camera math, not visual confirmation —
  expect this to need at least one more tuning round from your screenshots,
  same as the last three phases.
