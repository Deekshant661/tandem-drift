/**
 * Data-driven vehicle description. New vehicles (trucks, vans, tractors…) are
 * new spec objects — no gameplay or renderer changes required.
 * Dimensions in meters, colors as hex strings. Local axes: x right, y up,
 * z forward is NEGATIVE z in three-space after the scene's y-flip mapping —
 * the Vehicle component handles orientation; specs use intuitive "length
 * along travel" semantics.
 */
export interface VehicleSpec {
  name: string;
  chassis: { width: number; height: number; length: number; color: string; yOffset: number };
  cabin: { width: number; height: number; length: number; color: string; yOffset: number; zOffset: number };
  wheels: {
    radius: number;
    thickness: number;
    color: string;
    /** [x, z] positions of the four wheels: FL, FR, RL, RR (z = forward). */
    positions: [number, number][];
  };
  lights: {
    /** Headlights at the front, [x, y, z] each. */
    head: [number, number, number][];
    /** Tail cluster (brake red / reverse white), [x, y, z] each. */
    tail: [number, number, number][];
  };
  /** Character seat anchor points, [x, y, z]: index 0 = pilot, 1 = engineer. */
  seats: [number, number, number][];
}

/** The starter car — a cheerful open-top compact. */
export const compact01: VehicleSpec = {
  name: 'compact01',
  chassis: { width: 1.8, height: 0.55, length: 3.9, color: '#e0484d', yOffset: 0.5 },
  cabin: { width: 1.55, height: 0.35, length: 1.9, color: '#f6d7d2', yOffset: 0.95, zOffset: -0.25 },
  wheels: {
    radius: 0.38,
    thickness: 0.26,
    color: '#2b2f36',
    positions: [
      [-0.82, 1.25],
      [0.82, 1.25],
      [-0.82, -1.25],
      [0.82, -1.25],
    ],
  },
  lights: {
    head: [
      [-0.55, 0.62, 1.96],
      [0.55, 0.62, 1.96],
    ],
    tail: [
      [-0.6, 0.62, -1.96],
      [0.6, 0.62, -1.96],
    ],
  },
  seats: [
    [-0.42, 1.0, 0.25],
    [0.42, 1.0, 0.25],
  ],
};
