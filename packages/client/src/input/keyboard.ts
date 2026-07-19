import { INPUT_SEND_HZ, NEUTRAL_INPUT, type ControlInput, type Seat } from '@tandem/shared';
import { ramp } from './ramp.js';

/** How fast steer/throttle ramp toward the held key's target, in units/sec.
 *  Turns the raw digital keyboard signal into something that feels analog
 *  instead of an on/off switch — the single biggest lever for "responsive
 *  but not twitchy" handling on keyboard. Braking stays instant: players
 *  expect the brake to bite the moment they press it. */
const STEER_RAMP_PER_SEC = 7;
const THROTTLE_RAMP_PER_SEC = 5;
const DT = 1 / INPUT_SEND_HZ;

/**
 * Keyboard capture. Both seats use the same keys; the server only honors the
 * fields your seat owns, so the bindings can overlap safely.
 *
 *   Pilot:    A/D or ←/→        steer
 *   Engineer: W or ↑ throttle, S or ↓ brake, Space handbrake
 */
export class KeyboardInput {
  private readonly down = new Set<string>();
  private steerValue = 0;
  private throttleValue = 0;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  private has(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  read(seat: Seat): ControlInput {
    const input: ControlInput = { ...NEUTRAL_INPUT };
    if (seat === 'pilot') {
      const targetSteer =
        (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
      this.steerValue = ramp(this.steerValue, targetSteer, STEER_RAMP_PER_SEC, DT);
      input.steer = this.steerValue;
    } else {
      const targetThrottle = this.has('KeyW', 'ArrowUp') ? 1 : 0;
      this.throttleValue = ramp(this.throttleValue, targetThrottle, THROTTLE_RAMP_PER_SEC, DT);
      input.throttle = this.throttleValue;
      input.brake = this.has('KeyS', 'ArrowDown') ? 1 : 0;
      input.handbrake = this.has('Space');
    }
    return input;
  }
}
