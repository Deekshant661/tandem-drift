/** Move `current` toward `target` at up to `perSec` units/second over `dt`
 *  seconds, without overshooting. Pure so it's testable without a DOM. */
export function ramp(current: number, target: number, perSec: number, dt: number): number {
  const maxStep = perSec * dt;
  const diff = target - current;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}
