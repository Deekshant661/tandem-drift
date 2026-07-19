import {
  combineSeatInputs,
  createSimWorld,
  INPUT_SEND_HZ,
  NEUTRAL_INPUT,
  setVehicleState,
  SIM_DT,
  SIM_HZ,
  snapshotVehicle,
  stepSim,
  type ControlInput,
  type Seat,
  type SimWorld,
  type SnapshotMsg,
  type TrackMap,
  type VehicleSnapshot,
} from '@tandem/shared';
import { lerpAngle } from './interpolation.js';

/** Sim ticks represented by one input packet (60 Hz sim / 30 Hz input = 2). */
const TICKS_PER_INPUT = Math.round(SIM_HZ / INPUT_SEND_HZ);

/**
 * Dual-input client prediction with reconciliation.
 *
 * A shared vehicle can't use classic single-player prediction: your inputs
 * alone don't determine its motion. Instead we predict with *your* unacked
 * inputs plus your partner's last-known input (which changes slowly relative
 * to RTT), and reconcile on every authoritative snapshot:
 *
 *   1. reset the local sim to the server's vehicle state,
 *   2. drop local inputs the server has acknowledged,
 *   3. replay the remaining unacked inputs (2 sim ticks each),
 *   4. fold the resulting pose jump into a decaying visual error offset so
 *      corrections are smoothed instead of snapping.
 */
export class Predictor {
  private readonly sim: SimWorld;
  private seat: Seat;
  private pending: Array<{ seq: number; input: ControlInput }> = [];
  private partnerInput: ControlInput = { ...NEUTRAL_INPUT };
  private errX = 0;
  private errY = 0;
  private errAngle = 0;
  private hasServerState = false;

  constructor(map: TrackMap, seat: Seat) {
    this.sim = createSimWorld(map);
    this.seat = seat;
  }

  /** Called on seat swap: local input history no longer applies to the new seat. */
  setSeat(seat: Seat): void {
    this.seat = seat;
    this.pending = [];
  }

  /** Record and immediately simulate a locally-issued input packet. */
  addLocalInput(seq: number, input: ControlInput): void {
    if (!this.hasServerState) return;
    this.pending.push({ seq, input });
    // Bound memory if the server stops acking (e.g. mid-reconnect).
    if (this.pending.length > 60) this.pending.shift();
    this.stepTicks(input, TICKS_PER_INPUT);
  }

  /** Reconcile against an authoritative snapshot. */
  onSnapshot(msg: SnapshotMsg): void {
    const before = this.hasServerState ? snapshotVehicle(this.sim) : null;

    setVehicleState(this.sim, msg.vehicle);
    this.hasServerState = true;
    this.partnerInput = this.seat === 'pilot' ? msg.inputs.engineer : msg.inputs.pilot;

    const acked = msg.ack[this.seat];
    this.pending = this.pending.filter((p) => p.seq > acked);
    for (const p of this.pending) this.stepTicks(p.input, TICKS_PER_INPUT);

    if (before) {
      // Fold the correction into the error offset so the car glides, not snaps.
      const after = snapshotVehicle(this.sim);
      this.errX += before.x - after.x;
      this.errY += before.y - after.y;
      // Shortest-path angular difference (lerpAngle at t=1 lands on `before`
      // going the short way; subtracting `after` yields the signed delta).
      this.errAngle += lerpAngle(after.angle, before.angle, 1) - after.angle;
      // Clamp runaway error (teleports, resets): beyond 5 m just snap.
      if (Math.hypot(this.errX, this.errY) > 5) {
        this.errX = 0;
        this.errY = 0;
        this.errAngle = 0;
      }
    }
  }

  /** Current smoothed pose for rendering; decays the error offset each call. */
  sample(): VehicleSnapshot | null {
    if (!this.hasServerState) return null;
    const decay = 0.85; // per render frame at ~60fps → error halves in ~4 frames
    this.errX *= decay;
    this.errY *= decay;
    this.errAngle *= decay;
    const s = snapshotVehicle(this.sim);
    return { ...s, x: s.x + this.errX, y: s.y + this.errY, angle: s.angle + this.errAngle };
  }

  private stepTicks(myInput: ControlInput, ticks: number): void {
    const combined =
      this.seat === 'pilot'
        ? combineSeatInputs(myInput, this.partnerInput)
        : combineSeatInputs(this.partnerInput, myInput);
    for (let i = 0; i < ticks; i++) stepSim(this.sim, combined, SIM_DT);
  }
}
