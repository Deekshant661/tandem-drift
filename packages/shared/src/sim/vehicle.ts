/**
 * Top-down arcade car on planck.js (Box2D).
 *
 * Model: a single dynamic chassis body. Each fixed tick we
 *  1. cancel lateral velocity (tire grip) — reduced grip while handbraking,
 *  2. apply drive force along the forward axis from throttle,
 *  3. apply braking force against the velocity,
 *  4. steer by driving angular velocity toward a speed-scaled target.
 *
 * Pure functions over a planck World so the identical code runs on the
 * authoritative server and (later) in the client for prediction.
 */
import { World, Body, Vec2, Box, Edge } from 'planck';
import type { ControlInput, VehicleSnapshot } from '../protocol.js';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../constants.js';

export const VEHICLE_TUNING = {
  /** Chassis half-extents, meters. */
  halfWidth: 0.9,
  halfLength: 2.0,
  density: 12,
  /** Peak engine force, newtons. */
  maxDriveForce: 4200,
  /** Peak braking force, newtons. */
  maxBrakeForce: 6000,
  /** Max yaw rate at full steer, rad/s. */
  maxTurnRate: 2.6,
  /** Speed (m/s) at which full steering authority is reached. */
  steerFullAuthoritySpeed: 6,
  /** Fraction of lateral velocity cancelled per tick with grip. */
  gripNormal: 0.9,
  /** Fraction cancelled per tick with handbrake pulled (drift). */
  gripHandbrake: 0.12,
  linearDamping: 0.35,
  angularDamping: 3.0,
} as const;

export interface SimWorld {
  world: World;
  vehicle: Body;
}

/** Build the walled arena and one vehicle at the center. */
export function createSimWorld(): SimWorld {
  const world = new World({ gravity: new Vec2(0, 0) });

  const walls = world.createBody({ type: 'static' });
  const w = ARENA_WIDTH / 2;
  const h = ARENA_HEIGHT / 2;
  const corners = [new Vec2(-w, -h), new Vec2(w, -h), new Vec2(w, h), new Vec2(-w, h)];
  for (let i = 0; i < 4; i++) {
    walls.createFixture({
      shape: new Edge(corners[i]!, corners[(i + 1) % 4]!),
      restitution: 0.4,
    });
  }

  const vehicle = world.createBody({
    type: 'dynamic',
    position: new Vec2(0, 0),
    angle: 0,
    linearDamping: VEHICLE_TUNING.linearDamping,
    angularDamping: VEHICLE_TUNING.angularDamping,
  });
  vehicle.createFixture({
    shape: new Box(VEHICLE_TUNING.halfWidth, VEHICLE_TUNING.halfLength),
    density: VEHICLE_TUNING.density,
    friction: 0.3,
    restitution: 0.2,
  });

  return { world, vehicle };
}

/** Apply one player's combined controls for a single fixed tick, then step the world. */
export function stepSim(sim: SimWorld, input: ControlInput, dt: number): void {
  const body = sim.vehicle;
  const t = VEHICLE_TUNING;

  const forward = body.getWorldVector(new Vec2(0, 1));
  const right = body.getWorldVector(new Vec2(1, 0));
  const vel = body.getLinearVelocity();
  const mass = body.getMass();

  // 1. Tire grip: cancel a fraction of lateral velocity via impulse.
  const grip = input.handbrake ? t.gripHandbrake : t.gripNormal;
  const lateralSpeed = Vec2.dot(vel, right);
  const lateralImpulse = right.clone().mul(-lateralSpeed * grip * mass);
  body.applyLinearImpulse(lateralImpulse, body.getWorldCenter(), true);

  // 2. Drive.
  if (input.throttle > 0 && !input.handbrake) {
    body.applyForceToCenter(forward.clone().mul(input.throttle * t.maxDriveForce), true);
  }

  // 3. Brake: force opposing forward velocity (never reverses through zero
  //    because damping + per-tick force can't flip sign meaningfully at low speed).
  const forwardSpeed = Vec2.dot(body.getLinearVelocity(), forward);
  if (input.brake > 0 && Math.abs(forwardSpeed) > 0.05) {
    const dir = forwardSpeed > 0 ? -1 : 1;
    body.applyForceToCenter(forward.clone().mul(dir * input.brake * t.maxBrakeForce), true);
  }

  // 4. Steering: authority scales with speed so the car can't spin in place,
  //    and reverses with reverse travel like real steering geometry.
  const speedFactor = Math.min(1, Math.abs(forwardSpeed) / t.steerFullAuthoritySpeed);
  const direction = forwardSpeed >= 0 ? 1 : -1;
  const targetYaw = input.steer * t.maxTurnRate * speedFactor * direction;
  body.setAngularVelocity(targetYaw + (body.getAngularVelocity() - targetYaw) * 0.5);

  sim.world.step(dt);
}

export function snapshotVehicle(sim: SimWorld): VehicleSnapshot {
  const b = sim.vehicle;
  const p = b.getPosition();
  const v = b.getLinearVelocity();
  return {
    x: p.x,
    y: p.y,
    angle: b.getAngle(),
    vx: v.x,
    vy: v.y,
    angularVelocity: b.getAngularVelocity(),
  };
}

/** Combine the two seats' inputs into the single control set the sim consumes. */
export function combineSeatInputs(
  pilot: ControlInput,
  engineer: ControlInput,
): ControlInput {
  return {
    steer: pilot.steer,
    throttle: engineer.throttle,
    brake: engineer.brake,
    handbrake: engineer.handbrake,
  };
}
