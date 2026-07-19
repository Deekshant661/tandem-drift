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
  private readonly delayMs: number;
  private readonly maxSize = 64;

  constructor(delayMs: number) {
    this.delayMs = delayMs;
  }

  push(time: number, vehicle: VehicleSnapshot): void {
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
