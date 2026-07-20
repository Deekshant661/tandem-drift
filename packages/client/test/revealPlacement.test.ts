import { describe, expect, it } from 'vitest';
import { fernvale, sampleRoad } from '@tandem/shared';
import { reveal } from '../src/scene/environment/revealPlacement.js';

describe('reveal', () => {
  const samples = sampleRoad(fernvale().roads[0]!, 12);

  it('moves forward along the direction of travel, not backward', () => {
    // Village start (0, 120) heading toward (48, 110) — "ahead" must land
    // further along that direction, not behind the car.
    const p = reveal(samples, 0, 120, 20, 0);
    expect(p.x).toBeGreaterThan(0); // road heads toward +x from the start
  });

  it('offsets to the side, landing clear of the corridor', () => {
    const p = reveal(samples, 0, 120, 15, 20);
    let minGap = Infinity;
    for (const s of samples) minGap = Math.min(minGap, Math.hypot(p.x - s.x, p.y - s.y) - s.width);
    expect(minGap).toBeGreaterThan(5);
  });

  it('is deterministic', () => {
    const a = reveal(samples, -100, -60, 30, 15);
    const b = reveal(samples, -100, -60, 30, 15);
    expect(a).toEqual(b);
  });

  it('returns a finite point even for a large ahead distance (wraps the loop)', () => {
    const p = reveal(samples, 0, 120, 2000, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});
