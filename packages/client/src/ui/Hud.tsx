import { useEffect, useRef } from 'react';
import type { GameClient } from '../game/client.js';
import { useGameClient } from '../game/store.js';
import type { Role } from '@tandem/shared';

function formatLap(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}

function roleName(role: Role): JSX.Element {
  switch (role) {
    case 'pilot':
      return <span className="seat-pilot">PILOT</span>;
    case 'engineer':
      return <span className="seat-engineer">ENGINEER</span>;
    case 'spectator':
      return <span>SPECTATOR</span>;
  }
}

/** Bottom-left speedometer with gear slot. Speed animates via rAF (not React). */
function Speedometer({ client }: { client: GameClient }): JSX.Element {
  const speedRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const p = client.poseRef.current;
      if (p && speedRef.current && gearRef.current) {
        const speed = Math.hypot(p.vx, p.vy) * 3.6;
        const vf = p.vx * -Math.sin(p.angle) + p.vy * Math.cos(p.angle);
        speedRef.current.textContent = String(Math.round(speed));
        // Gear slot future-proofs the HUD for reverse/manual vehicles.
        gearRef.current.textContent = vf < -0.3 ? 'R' : 'D';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [client]);

  return (
    <div className="hud-card speedo">
      <div className="speed-value" ref={speedRef}>0</div>
      <div className="speed-unit">km/h</div>
      <div className="gear" ref={gearRef}>D</div>
    </div>
  );
}

export function Hud({ client }: { client: GameClient }): JSX.Element | null {
  const s = useGameClient(client);

  if (s.phase === 'lobby') return null;
  if (s.phase !== 'playing') {
    return (
      <div className="hud-card status-card">
        {s.errorText ??
          (s.phase === 'disconnected'
            ? 'Disconnected from server. Refresh to try again.'
            : 'Connecting…')}
      </div>
    );
  }

  const partner = s.players.find((p) => p.role !== s.role && p.role !== 'spectator');
  return (
    <>
      {/* top-left: room card */}
      <div className="hud-card room-card">
        <div className="room-line">
          Room <span className="code">{s.roomCode}</span>
        </div>
        <div>
          You: {s.role && roleName(s.role)}
          {s.role !== 'spectator' && (
            <> · {partner ? `Partner: ${partner.name}` : 'waiting for partner…'}</>
          )}
        </div>
        <div className="dim">Ping {Math.round(s.rttMs)} ms</div>
        {s.race && (
          <div className="dim">
            Lap {s.race.lap} · {formatLap(s.race.currentLapMs)} · Best{' '}
            {formatLap(s.race.bestLapMs)}
          </div>
        )}
        {s.swapPending && <div className="swap-note">Swap requested — partner must press Tab</div>}
      </div>
      {/* top-center: reserved for countdown / missions (future modes) */}
      <div className="hud-top-center" />
      <Speedometer client={client} />
      {/* bottom-right area holds the minimap (App) + controls card */}
      <div className="hud-card controls-card">
        {s.role === 'pilot' && <span>A/D steer · Tab swap · C look back · H horn · Esc menu</span>}
        {s.role === 'engineer' && (
          <span>W gas · S brake · Space drift · Tab swap · C look back · H horn · Esc menu</span>
        )}
        {s.role === 'spectator' && <span>Spectating · Esc menu</span>}
      </div>
    </>
  );
}
