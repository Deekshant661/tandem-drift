import { describe, expect, it } from 'vitest';
import { bandWeight, engineBandWeights } from '../src/audio/engineCurve.js';

describe('bandWeight', () => {
  it('peaks at 1 at the center and falls smoothly to 0 at the edge', () => {
    expect(bandWeight(0.5, 0.5, 0.4)).toBeCloseTo(1);
    expect(bandWeight(0.9, 0.5, 0.4)).toBeCloseTo(0, 5);
    expect(bandWeight(1.5, 0.5, 0.4)).toBe(0); // beyond width: exactly 0, never negative
  });

  it('is monotonically non-increasing as distance from center grows', () => {
    const center = 0.4;
    const width = 0.5;
    let prev = bandWeight(center, center, width);
    for (let d = 0.05; d <= width; d += 0.05) {
      const w = bandWeight(center + d, center, width);
      expect(w).toBeLessThanOrEqual(prev + 1e-9);
      prev = w;
    }
  });
});

describe('engineBandWeights', () => {
  it('is idle-dominant at rest and high-dominant at top speed', () => {
    const atRest = engineBandWeights(0);
    expect(atRest.idle).toBeGreaterThan(atRest.low);
    expect(atRest.idle).toBeGreaterThan(atRest.high);

    const atSpeed = engineBandWeights(1);
    expect(atSpeed.high).toBeGreaterThan(atSpeed.idle);
  });

  it('never leaves a silent gap — some band has meaningful weight at every speed', () => {
    for (let norm = 0; norm <= 1; norm += 0.05) {
      const w = engineBandWeights(norm);
      expect(Math.max(w.idle, w.low, w.high)).toBeGreaterThan(0.15);
    }
  });
});
