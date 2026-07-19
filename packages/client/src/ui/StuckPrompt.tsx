import { useEffect, useRef, useState } from 'react';
import type { GameClient } from '../game/client.js';

const STUCK_SPEED_MS = 0.6;
const STUCK_SECONDS = 4;

/**
 * "Press R to Recover" hint that appears after several continuous seconds of
 * near-zero speed — the player might just be stopped to chat, so this is a
 * gentle, dismissible suggestion, not a blocking prompt. Purely an
 * observation of poseRef; no server round-trip involved.
 */
export function StuckPrompt({ client }: { client: GameClient }): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const lowSpeedSeconds = useRef(0);
  const lastTime = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number): void => {
      const last = lastTime.current;
      lastTime.current = now;
      const dt = last === null ? 0 : (now - last) / 1000;
      const p = client.poseRef.current;
      const speed = p ? Math.hypot(p.vx, p.vy) : 0;

      if (speed < STUCK_SPEED_MS) {
        lowSpeedSeconds.current += dt;
      } else {
        lowSpeedSeconds.current = 0;
      }
      setVisible((v) => {
        const shouldShow = lowSpeedSeconds.current >= STUCK_SECONDS;
        return shouldShow === v ? v : shouldShow;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [client]);

  if (!visible) return null;
  return <div className="stuck-prompt">Stuck? Press R to Recover</div>;
}
