import { describe, expect, it } from 'vitest';
import { FERNVALE_LANDMARKS, getFernvaleRepeatedPlacements } from '../src/scene/environment/fernvaleScenery.js';

/**
 * Operationalizes Phase 4's success metrics ("every major corner reveals a
 * new focal point", "no view dominated by empty flat grass") as something
 * checkable, not vibes: for each named moment on the loop, at least one
 * deliberate placement (a named landmark or a scenery cluster item) must
 * exist within a reasonable "in view" radius of that road point. This
 * can't verify the view actually *looks* good — only that composition
 * wasn't skipped for that stretch.
 */
describe('Fernvale composition audit', () => {
  const landmarks = FERNVALE_LANDMARKS;
  const scenery = getFernvaleRepeatedPlacements();
  const allPoints = [
    ...landmarks.map((l) => ({ x: l.x, y: l.y, label: l.name })),
    ...scenery.map((p) => ({ x: p.x, y: p.y, label: p.asset.kind })),
  ];

  function nearestDistance(x: number, y: number): number {
    let min = Infinity;
    for (const p of allPoints) min = Math.min(min, Math.hypot(x - p.x, y - p.y));
    return min;
  }

  const majorMoments: Array<[string, number, number, number]> = [
    ['village start', 0, 120, 45],
    ['village/farmland transition (hero oak)', 48, 110, 45],
    ['tight 90° corner', 115, 0, 20],
    ['bridge crossing', 60, -95, 15],
    ['blind crest into forest', 25, -110, 20],
    ['forest hairpin', -45, -105, 20],
    ['lake reveal', -100, -60, 40],
    ['fast sweeper / cliff', -125, -20, 45],
    ['windmill fields', -130, 60, 90],
    ['return to village', -20, 118, 45],
  ];

  it.each(majorMoments)('%s has a focal placement within view (%d, %d) within %dm', (name, x, y, maxDist) => {
    const dist = nearestDistance(x, y);
    expect(dist).toBeLessThan(maxDist);
  });

  it('has at least 8 distinct named landmarks for orientation (postcard-moment budget)', () => {
    const uniqueNames = new Set(landmarks.map((l) => l.name));
    expect(uniqueNames.size).toBeGreaterThanOrEqual(8);
  });

  it('has at least two far background silhouettes breaking the skyline', () => {
    // "Far" = well beyond the loop's own extent (road spans roughly
    // x:[-135,118] y:[-115,120]), i.e. not a near-road prop.
    const farLandmarks = landmarks.filter((l) => Math.hypot(l.x, l.y) > 200);
    const distinctFarNames = new Set(farLandmarks.map((l) => l.name.replace(/-(base|mid|roof)$/, '')));
    expect(distinctFarNames.size).toBeGreaterThanOrEqual(2);
  });
});
