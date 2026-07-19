export interface RoadPoint {
  x: number;
  y: number;
  /** Elevation. Stored in the format from day one; Phase 2 physics is flat (z = 0). */
  z: number;
  /** Road half-width, meters. */
  width: number;
  surface: 'paved' | 'dirt';
}

export interface Road {
  id: string;
  /** Closed loop (Catmull-Rom wraps) or open segment (endpoints clamp). */
  closed: boolean;
  points: RoadPoint[];
}

export interface Zone {
  kind: 'village' | 'forest' | 'lake' | 'field' | 'tunnel' | 'viewpoint' | 'parking';
  x: number;
  y: number;
  radius: number;
}

export interface Landmark {
  kind: 'windmill' | 'bridge' | 'mountain';
  x: number;
  y: number;
  rotation: number;
}

/**
 * World description: road network + gameplay progress + scenery annotations.
 * Both sides consume it — the server via worldToTrackMap (flat 2D physics),
 * the client via the spline sampler (3D visuals). `progress` is a tagged
 * union with a single variant today; point-to-point/missions add variants
 * later without protocol changes.
 */
export interface WorldMap {
  name: string;
  /** Seed for deterministic scenery scatter (mulberry32). */
  seed: number;
  roads: Road[];
  /** Spawn position expressed as fraction t ∈ [0,1) along a road. */
  spawn: { roadId: string; t: number };
  progress: { mode: 'lap'; roadId: string; gates: number };
  zones: Zone[];
  landmarks: Landmark[];
}
