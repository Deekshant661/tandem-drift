import { SIM_HZ } from '../constants.js';
import type { Checkpoint } from '../maps/types.js';

export interface RaceState {
  /** Completed laps. */
  lap: number;
  /** Index of the next gate to pass, or -1 when the map has no checkpoints. */
  nextCheckpoint: number;
  currentLapMs: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
}

/**
 * Ordered-gate lap tracking. A gate is "passed" when the vehicle enters its
 * radius while it is the next gate; completing the full sequence and re-passing
 * gate 0 closes the lap. Radius checks at 60 Hz are robust for our speeds
 * (~30 m/s * 1/60 s = 0.5 m per tick vs. 11 m gate radius).
 */
export class RaceTracker {
  private readonly checkpoints: Checkpoint[];
  private next = 0;
  private lap = 0;
  private lapStartTick: number;
  private lastLapTicks: number | null = null;
  private bestLapTicks: number | null = null;

  constructor(checkpoints: Checkpoint[], startTick = 0) {
    this.checkpoints = checkpoints;
    this.lapStartTick = startTick;
  }

  update(x: number, y: number, tick: number): void {
    if (this.checkpoints.length === 0) return;
    const gate = this.checkpoints[this.next]!;
    const dx = x - gate.x;
    const dy = y - gate.y;
    if (dx * dx + dy * dy > gate.radius * gate.radius) return;

    if (this.next === 0 && this.lapOpened) {
      const ticks = tick - this.lapStartTick;
      this.lap++;
      this.lastLapTicks = ticks;
      this.bestLapTicks = this.bestLapTicks === null ? ticks : Math.min(this.bestLapTicks, ticks);
      this.lapStartTick = tick;
    }
    this.lapOpened = true;
    this.next = (this.next + 1) % this.checkpoints.length;
  }

  /** True once the car has left gate 0 at least once (so spawning inside it doesn't score). */
  private lapOpened = false;

  state(tick: number): RaceState {
    const toMs = (ticks: number): number => Math.round((ticks / SIM_HZ) * 1000);
    return {
      lap: this.lap,
      nextCheckpoint: this.checkpoints.length === 0 ? -1 : this.next,
      currentLapMs: toMs(tick - this.lapStartTick),
      lastLapMs: this.lastLapTicks === null ? null : toMs(this.lastLapTicks),
      bestLapMs: this.bestLapTicks === null ? null : toMs(this.bestLapTicks),
    };
  }
}
