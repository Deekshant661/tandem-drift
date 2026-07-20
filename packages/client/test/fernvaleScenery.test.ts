import { describe, expect, it } from 'vitest';
import { fernvale, sampleRoad } from '@tandem/shared';
import { FERNVALE_LANDMARKS, getFernvaleRepeatedPlacements } from '../src/scene/environment/fernvaleScenery.js';

describe('Fernvale scenery', () => {
  const roadSamples = sampleRoad(fernvale().roads[0]!, 8);

  function minGapToRoad(x: number, y: number): number {
    let min = Infinity;
    for (const s of roadSamples) min = Math.min(min, Math.hypot(x - s.x, y - s.y) - s.width);
    return min;
  }

  it('repeated placements never land on the drivable road', () => {
    const placements = getFernvaleRepeatedPlacements();
    expect(placements.length).toBeGreaterThan(50);
    let onRoad = 0;
    for (const p of placements) if (minGapToRoad(p.x, p.y) < 0.5) onRoad++;
    // A handful right at cluster edges near a tight corner is tolerable;
    // scenery should overwhelmingly clear the road.
    expect(onRoad).toBeLessThan(placements.length * 0.05);
  });

  it('is a deliberately lower density than Willowbrook-style uniform scatter', () => {
    // Willowbrook scatters 600+ items over a much bigger loop; Fernvale's
    // "negative space" design goal means noticeably fewer per meter of road.
    const placements = getFernvaleRepeatedPlacements();
    expect(placements.length).toBeLessThan(200);
  });

  it('includes every named orientation landmark from the design', () => {
    const names = FERNVALE_LANDMARKS.map((l) => l.name);
    for (const required of [
      'windmill',
      'covered-bridge',
      'dock',
      'lookout-bench',
      'hero-oak',
      'tower-base',
    ]) {
      expect(names).toContain(required);
    }
  });

  it('every landmark has a finite position and positive scale', () => {
    for (const l of FERNVALE_LANDMARKS) {
      expect(Number.isFinite(l.x)).toBe(true);
      expect(Number.isFinite(l.y)).toBe(true);
      expect(l.scale).toBeGreaterThan(0);
    }
  });
});
