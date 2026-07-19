export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Checkpoint {
  x: number;
  y: number;
  radius: number;
}

export interface TrackMap {
  name: string;
  spawn: { x: number; y: number; angle: number };
  walls: WallSegment[];
  /** Ordered gates; passing the last one completes a lap. Empty = free drive. */
  checkpoints: Checkpoint[];
}
