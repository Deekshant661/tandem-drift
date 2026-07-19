import { useEffect, useRef } from 'react';
import type { GameClient } from '../game/client.js';

const HOLD_MS = 140;

/**
 * Full-screen fade transition for recovery. Two triggers converge here:
 *   - a local 'R' press starts covering the screen immediately (responsive
 *     feedback, no round-trip wait);
 *   - a server-confirmed recovery (client.recoveryRef.version bump) is
 *     required before the screen is allowed to reveal again — so even under
 *     high ping, the pop to the new position always happens while hidden.
 * The automatic out-of-bounds safety net has no local keypress, so a version
 * bump alone (with no prior press) also drives a full cover→hold→reveal.
 * All state lives in refs and is painted via direct style writes — no React
 * re-renders on this hot path.
 */
export function RecoveryOverlay({ client }: { client: GameClient }): JSX.Element {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let opacity = 0;
    let target = 0;
    let awaitingConfirm = false;
    let fullyCoveredAt: number | null = null;
    let lastVersion = client.recoveryRef.version;
    let raf = 0;

    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'KeyR' && !e.repeat) {
        target = 1;
        awaitingConfirm = true;
      }
    };
    window.addEventListener('keydown', onKey);

    const tick = (now: number): void => {
      if (client.recoveryRef.version !== lastVersion) {
        lastVersion = client.recoveryRef.version;
        awaitingConfirm = false;
        target = 1; // covers even an automatic recovery with no prior press
      }

      if (target === 1 && opacity >= 0.98) {
        if (fullyCoveredAt === null) fullyCoveredAt = now;
        if (!awaitingConfirm && now - fullyCoveredAt >= HOLD_MS) {
          target = 0;
          fullyCoveredAt = null;
        }
      } else if (target === 0) {
        fullyCoveredAt = null;
      }

      const speed = target === 1 ? 9 : 3.2; // cover quickly, reveal a touch slower
      opacity += (target - opacity) * Math.min(1, speed / 60);
      if (divRef.current) divRef.current.style.opacity = String(opacity);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    };
  }, [client]);

  return <div id="recovery-overlay" ref={divRef} style={{ opacity: 0 }} />;
}
