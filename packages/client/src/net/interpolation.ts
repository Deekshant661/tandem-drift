import type { VehicleSnapshot } from '@tandem/shared';

export interface TimedSnapshot {
  /** Local receive time, ms. */
  time: number;
  vehicle: VehicleSnapshot;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path angle interpolation so the car never spins the long way round. */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * Snapshot interpolation buffer. Clients render `delayMs` in the past and
 * interpolate between the two snapshots straddling render time — standard
 * technique for smooth motion from 20 Hz authoritative snapshots.
 */
export class SnapshotBuffer {
  private readonly buffer: TimedSnapshot[] = [];
  private delayMs: number;
  private readonly maxSize = 64;
  /** Recent inter-arrival gaps for jitter estimation. */
  private readonly gaps: number[] = [];
  private lastArrival: number | null = null;
  private adaptive = false;

  constructor(delayMs: number) {
    this.delayMs = delayMs;
  }

  /** Discard buffered history — used after a teleport (recovery) so the
   *  interpolator doesn't glide in from the pre-recovery position. */
  reset(): void {
    this.buffer.length = 0;
    this.gaps.length = 0;
    this.lastArrival = null;
  }

  /**
   * Enable adaptive delay: the interpolation delay tracks measured snapshot
   * inter-arrival jitter (mean gap + 2.5 sigma, clamped to [60, 300] ms), so
   * clean connections get lower latency and jittery ones stop stuttering.
   */
  enableAdaptiveDelay(): void {
    this.adaptive = true;
  }

  get currentDelayMs(): number {
    return this.delayMs;
  }

  push(time: number, vehicle: VehicleSnapshot): void {
    if (this.lastArrival !== null) {
      this.gaps.push(time - this.lastArrival);
      if (this.gaps.length > 40) this.gaps.shift();
      if (this.adaptive && this.gaps.length >= 10) {
        const mean = this.gaps.reduce((a, b) => a + b, 0) / this.gaps.length;
        const variance =
          this.gaps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / this.gaps.length;
        const target = mean + 2.5 * Math.sqrt(variance);
        const clamped = Math.min(300, Math.max(60, target));
        // Move gently toward the target so the car never visibly jumps in time.
        this.delayMs += (clamped - this.delayMs) * 0.05;
      }
    }
    this.lastArrival = time;
    this.buffer.push({ time, vehicle });
    if (this.buffer.length > this.maxSize) this.buffer.shift();
  }

  /** Interpolated state at (now - delay); null until two snapshots exist. */
  sample(now: number): VehicleSnapshot | null {
    if (this.buffer.length === 0) return null;
    if (this.buffer.length === 1) return this.buffer[0]!.vehicle;

    const renderTime = now - this.delayMs;

    // Drop snapshots older than the pair straddling renderTime.
    while (this.buffer.length > 2 && this.buffer[1]!.time <= renderTime) {
      this.buffer.shift();
    }

    const a = this.buffer[0]!;
    const b = this.buffer[1]!;

    if (renderTime <= a.time) return a.vehicle;
    if (renderTime >= b.time) return b.vehicle; // starved: hold latest, no extrapolation

    const t = (renderTime - a.time) / (b.time - a.time);
    return {
      x: lerp(a.vehicle.x, b.vehicle.x, t),
      y: lerp(a.vehicle.y, b.vehicle.y, t),
      angle: lerpAngle(a.vehicle.angle, b.vehicle.angle, t),
      vx: lerp(a.vehicle.vx, b.vehicle.vx, t),
      vy: lerp(a.vehicle.vy, b.vehicle.vy, t),
      angularVelocity: lerp(a.vehicle.angularVelocity, b.vehicle.angularVelocity, t),
    };
  }
}
