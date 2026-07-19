import { NEUTRAL_INPUT, type ControlInput, type Seat } from '@tandem/shared';

/**
 * Keyboard capture. Both seats use the same keys; the server only honors the
 * fields your seat owns, so the bindings can overlap safely.
 *
 *   Pilot:    A/D or ←/→        steer
 *   Engineer: W or ↑ throttle, S or ↓ brake, Space handbrake
 */
export class KeyboardInput {
  private readonly down = new Set<string>();

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
      input.steer =
        (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
    } else {
      input.throttle = this.has('KeyW', 'ArrowUp') ? 1 : 0;
      input.brake = this.has('KeyS', 'ArrowDown') ? 1 : 0;
      input.handbrake = this.has('Space');
    }
    return input;
  }
}
