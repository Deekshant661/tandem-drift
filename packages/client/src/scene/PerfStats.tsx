import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { perfStats } from './perfStore.js';

/**
 * Measures real metrics every ~500ms from the renderer's own counters
 * (gl.info) rather than guessing: draw calls and triangles come straight
 * from WebGL state; FPS/frame time from a rolling window; JS heap from
 * performance.memory where the browser exposes it (Chrome only).
 */
export function PerfStats(): null {
  const { gl } = useThree();
  const frames = useRef(0);
  const windowStart = useRef(performance.now());

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    const elapsed = now - windowStart.current;
    if (elapsed >= 500) {
      perfStats.fps = (frames.current * 1000) / elapsed;
      perfStats.frameMs = elapsed / frames.current;
      perfStats.drawCalls = gl.info.render.calls;
      perfStats.triangles = gl.info.render.triangles;
      perfStats.geometries = gl.info.memory.geometries;
      perfStats.textures = gl.info.memory.textures;
      const mem = (
        performance as unknown as {
          memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
        }
      ).memory;
      if (mem) {
        perfStats.heapMB = mem.usedJSHeapSize / 1048576;
        perfStats.heapLimitMB = mem.jsHeapSizeLimit / 1048576;
      }
      frames.current = 0;
      windowStart.current = now;
    }
  });

  return null;
}
