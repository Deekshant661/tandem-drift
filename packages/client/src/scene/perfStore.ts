/**
 * Live renderer/GPU/CPU metrics, updated by PerfStats (inside the Canvas)
 * and read by PerfOverlay (outside it). Plain mutable object instead of
 * React state — this updates every ~0.5s and must never trigger reconciles.
 */
export const perfStats = {
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  heapMB: 0,
  heapLimitMB: 0,
};
