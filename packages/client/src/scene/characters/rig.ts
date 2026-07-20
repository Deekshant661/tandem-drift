/**
 * CharacterRig: pure pose math for a seated character. Rendering applies the
 * returned transforms to named parts (body, head). Replacing blob characters
 * with modeled/animated ones later means swapping the component that consumes
 * these poses — gameplay code never changes.
 */
export type Seat = 'pilot' | 'engineer';

export interface RigInput {
  seat: Seat;
  /** m/s */
  speed: number;
  /** -1..1 (pilot's live steering) */
  steer: number;
  /** 0..1 */
  throttle: number;
  /** 0..1 */
  brake: number;
  /** 0..1 collision impulse (decaying) */
  collision: number;
  /** seconds, for idle/bounce phase */
  time: number;
}

export interface RigPose {
  /** Body vertical bounce offset (m). */
  bounceY: number;
  /** Body lean: forward/backward tilt (rad, + = backward under acceleration). */
  leanPitch: number;
  /** Body lean into corners (rad, + = toward the right). */
  leanRoll: number;
  /** Head yaw toward steering direction (rad) — pilots only. */
  headYaw: number;
  /** Collision jolt vertical kick (m). */
  joltY: number;
}

export function computeRigPose(i: RigInput): RigPose {
  // 37 m/s (~132 km/h) is the car's real terminal velocity under drag.
  const speedNorm = Math.min(1, i.speed / 37);
  // Idle breathing + speed-scaled road bounce; seats desync via phase offset.
  const phase = i.seat === 'pilot' ? 0 : 1.3;
  const bounceY =
    0.015 * Math.sin(i.time * 2 + phase) +
    0.035 * speedNorm * Math.sin(i.time * (6 + speedNorm * 10) + phase);
  // Accelerating pushes riders back; braking throws them forward.
  const leanPitch = i.throttle * 0.12 * speedNorm - i.brake * 0.22 * speedNorm;
  // Cornering leans riders outward (opposite the turn), stronger with speed.
  const leanRoll = -i.steer * 0.25 * speedNorm;
  // Pilot glances into the turn; engineer keeps eyes forward.
  const headYaw = i.seat === 'pilot' ? i.steer * 0.5 : 0;
  const joltY = i.collision * 0.12;
  return { bounceY, leanPitch, leanRoll, headYaw, joltY };
}
