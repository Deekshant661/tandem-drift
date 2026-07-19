import { useEffect, useMemo, useRef } from 'react';
import { sampleRoad, type WorldMap } from '@tandem/shared';
import type { GameClient } from '../game/client.js';

const SIZE = 148;
const PAD = 10;

/** SVG sketch of the road loop with a live car dot. */
export function Minimap({ client, world }: { client: GameClient; world: WorldMap }): JSX.Element {
  const dotRef = useRef<SVGCircleElement>(null);

  const { path, toMap } = useMemo(() => {
    const samples = sampleRoad(world.roads[0]!, 4);
    const xs = samples.map((s) => s.x);
    const ys = samples.map((s) => s.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scale = (SIZE - PAD * 2) / Math.max(maxX - minX, maxY - minY);
    const map = (x: number, y: number): [number, number] => [
      PAD + (x - minX) * scale,
      SIZE - PAD - (y - minY) * scale, // sim +y is up; SVG +y is down
    ];
    const d =
      samples
        .map((s, i) => {
          const [px, py] = map(s.x, s.y);
          return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
        })
        .join(' ') + ' Z';
    return { path: d, toMap: map };
  }, [world]);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const p = client.poseRef.current;
      const dot = dotRef.current;
      if (p && dot) {
        const [px, py] = toMap(p.x, p.y);
        dot.setAttribute('cx', String(px));
        dot.setAttribute('cy', String(py));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [client, toMap]);

  return (
    <svg id="minimap" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <path d={path} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={3} strokeLinejoin="round" />
      <circle ref={dotRef} r={4} fill="#ffd166" stroke="#7a4a00" strokeWidth={1} />
    </svg>
  );
}
