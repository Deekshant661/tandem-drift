import { describe, expect, it } from 'vitest';
import type { VehicleSnapshot } from '@tandem/shared';
import { lerpAngle, SnapshotBuffer } from '../src/net/interpolation.js';

function snap(x: number, angle = 0): VehicleSnapshot {
  return { x, y: 0, angle, vx: 0, vy: 0, angularVelocity: 0 };
}

describe('SnapshotBuffer', () => {
  it('returns null with no data and the sole snapshot with one', () => {
    const buf = new SnapshotBuffer(100);
    expect(buf.sample(1000)).toBeNull();
    buf.push(0, snap(5));
    expect(buf.sample(1000)?.x).toBe(5);
  });

  it('interpolates linearly between the straddling snapshots', () => {
    const buf = new SnapshotBuffer(100);
    buf.push(1000, snap(0));
    buf.push(1050, snap(10));
    // renderTime = 1125 - 100 = 1025 → halfway
    expect(buf.sample(1125)?.x).toBeCloseTo(5);
    // renderTime = 1010 → 20% of the way
    expect(buf.sample(1110)?.x).toBeCloseTo(2);
  });

  it('holds the latest snapshot when starved instead of extrapolating', () => {
    const buf = new SnapshotBuffer(100);
    buf.push(1000, snap(0));
    buf.push(1050, snap(10));
    expect(buf.sample(5000)?.x).toBe(10);
  });

  it('discards snapshots that fall behind render time', () => {
    const buf = new SnapshotBuffer(100);
    for (let i = 0; i < 10; i++) buf.push(1000 + i * 50, snap(i));
    // renderTime = 1325: straddled by snapshots at 1300 (x=6) and 1350 (x=7)
    expect(buf.sample(1425)?.x).toBeCloseTo(6.5);
  });

  it('caps buffer growth', () => {
    const buf = new SnapshotBuffer(100);
    for (let i = 0; i < 1000; i++) buf.push(i, snap(i));
    // Oldest retained snapshot is 999 - 63 = 936; render far in the past clamps to it.
    expect(buf.sample(0)?.x).toBe(936);
  });
});

describe('adaptive delay', () => {
  it('stays fixed unless enabled', () => {
    const buf = new SnapshotBuffer(100);
    for (let i = 0; i < 30; i++) buf.push(i * 50, snap(i));
    expect(buf.currentDelayMs).toBe(100);
  });

  it('drifts down toward a low-jitter target', () => {
    const buf = new SnapshotBuffer(200);
    buf.enableAdaptiveDelay();
    // Perfectly regular 50 ms arrivals → target ≈ 60 ms (clamp floor).
    for (let i = 0; i < 200; i++) buf.push(i * 50, snap(i));
    expect(buf.currentDelayMs).toBeLessThan(100);
    expect(buf.currentDelayMs).toBeGreaterThanOrEqual(60);
  });

  it('rises under heavy jitter but stays clamped', () => {
    const buf = new SnapshotBuffer(60);
    buf.enableAdaptiveDelay();
    let t = 0;
    for (let i = 0; i < 300; i++) {
      t += i % 2 === 0 ? 10 : 240; // wildly alternating gaps
      buf.push(t, snap(i));
    }
    expect(buf.currentDelayMs).toBeGreaterThan(100);
    expect(buf.currentDelayMs).toBeLessThanOrEqual(300);
  });
});

describe('lerpAngle', () => {
  it('takes the short way across the ±π seam', () => {
    const a = Math.PI - 0.1;
    const b = -Math.PI + 0.1;
    const mid = lerpAngle(a, b, 0.5);
    // Short path crosses π, not zero.
    expect(Math.abs(Math.cos(mid) - Math.cos(Math.PI))).toBeLessThan(0.01);
  });

  it('is plain lerp for nearby angles', () => {
    expect(lerpAngle(0.2, 0.4, 0.5)).toBeCloseTo(0.3);
  });
});
