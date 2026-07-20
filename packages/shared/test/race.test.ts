import { describe, expect, it } from 'vitest';
import { SIM_HZ } from '../src/constants.js';
import { RaceTracker } from '../src/sim/race.js';
import { getMap, track01, track02, DEFAULT_MAP, PLAYABLE_MAPS } from '../src/maps/maps.js';
import type { Checkpoint } from '../src/maps/types.js';

const gates: Checkpoint[] = [
  { x: 0, y: 0, radius: 2, angle: 0 },
  { x: 10, y: 0, radius: 2, angle: 0 },
  { x: 10, y: 10, radius: 2, angle: 0 },
];

/** Drive the tracker through every gate in order once. */
function passAllGates(tracker: RaceTracker, startTick: number): number {
  let tick = startTick;
  for (const g of gates) {
    tick += SIM_HZ; // one second between gates
    tracker.update(g.x, g.y, tick);
  }
  return tick;
}

describe('RaceTracker', () => {
  it('advances gates only in order', () => {
    const t = new RaceTracker(gates);
    t.update(10, 10, 10); // gate 2 while gate 0 is next → ignored
    expect(t.state(10).nextCheckpoint).toBe(0);
    t.update(0, 0, 20);
    expect(t.state(20).nextCheckpoint).toBe(1);
    t.update(0, 0, 30); // re-entering gate 0 does nothing now
    expect(t.state(30).nextCheckpoint).toBe(1);
  });

  it('completes a lap and records last/best times', () => {
    const t = new RaceTracker(gates);
    let tick = passAllGates(t, 0);
    expect(t.state(tick).lap).toBe(0); // lap closes on re-passing gate 0

    tick += SIM_HZ;
    t.update(0, 0, tick); // back through start/finish
    const s = t.state(tick);
    expect(s.lap).toBe(1);
    expect(s.lastLapMs).toBe(4000); // 4 gate-to-gate seconds
    expect(s.bestLapMs).toBe(4000);
  });

  it('keeps the best of several laps', () => {
    const t = new RaceTracker(gates);
    // Lap 1: 4 s. Lap 2: gates passed twice as fast.
    let tick = passAllGates(t, 0);
    tick += SIM_HZ;
    t.update(0, 0, tick);
    const lap2Start = tick;
    for (const [i, g] of gates.slice(1).entries()) {
      t.update(g.x, g.y, lap2Start + (i + 1) * (SIM_HZ / 2));
    }
    tick = lap2Start + 2 * SIM_HZ;
    t.update(0, 0, tick);
    const s = t.state(tick);
    expect(s.lap).toBe(2);
    expect(s.lastLapMs).toBe(2000);
    expect(s.bestLapMs).toBe(2000);
  });

  it('spawning inside gate 0 does not start a lap count', () => {
    const t = new RaceTracker(gates);
    t.update(0, 0, 1); // spawn overlaps start/finish
    t.update(0, 0, 2);
    expect(t.state(2).lap).toBe(0);
    expect(t.state(2).nextCheckpoint).toBe(1);
  });

  it('is inert with no checkpoints (free drive)', () => {
    const t = new RaceTracker([]);
    t.update(5, 5, 100);
    expect(t.state(100)).toEqual({
      lap: 0,
      nextCheckpoint: -1,
      currentLapMs: Math.round((100 / SIM_HZ) * 1000),
      lastLapMs: null,
      bestLapMs: null,
    });
  });
});

describe('track maps', () => {
  it.each([
    ['track01', track01],
    ['track02', track02],
  ])('%s is well-formed', (_name, factory) => {
    const map = factory();
    expect(map.walls.length).toBeGreaterThan(8);
    expect(map.checkpoints.length).toBe(8);
    const start = map.checkpoints[0]!;
    const d = Math.hypot(map.spawn.x - start.x, map.spawn.y - start.y);
    expect(d).toBeLessThan(start.radius + 6); // spawn near start/finish
  });

  it('resolves maps by name with safe fallback', () => {
    expect(getMap('track02').name).toBe('track02');
    expect(getMap(undefined).name).toBe(DEFAULT_MAP);
    expect(getMap('no-such-map').name).toBe('track01');
    expect(Object.keys(PLAYABLE_MAPS)).toEqual(['track01', 'track02', 'willowbrook', 'fernvale']);
  });
});
