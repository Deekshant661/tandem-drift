import { useEffect, useRef, useState } from 'react';
import { perfStats } from '../scene/perfStore.js';

/**
 * Press P to toggle a live performance HUD: FPS, frame time, draw calls,
 * triangle count, GPU resource counts, and JS heap (Chrome only). Reads
 * perfStats directly via rAF — deliberately outside React state so the
 * overlay itself never causes a re-render.
 */
export function PerfOverlay(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'KeyP') setVisible((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const tick = (): void => {
      if (ref.current) {
        const s = perfStats;
        ref.current.textContent =
          `FPS ${s.fps.toFixed(0)}   frame ${s.frameMs.toFixed(1)} ms\n` +
          `draw calls ${s.drawCalls}   triangles ${(s.triangles / 1000).toFixed(1)}k\n` +
          `geometries ${s.geometries}   textures ${s.textures}\n` +
          (s.heapMB
            ? `heap ${s.heapMB.toFixed(0)} / ${s.heapLimitMB.toFixed(0)} MB`
            : 'heap: n/a (Chrome only)');
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;
  return <pre id="perf-overlay" ref={ref} />;
}
