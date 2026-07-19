import type { GameClient } from '../game/client.js';
import { useGameClient } from '../game/store.js';
import type { Role } from '@tandem/shared';

function formatLap(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}

function RoleLine({ role }: { role: Role }): JSX.Element {
  switch (role) {
    case 'pilot':
      return (
        <span>
          You are <span className="seat-pilot">PILOT</span> — steer with A/D
        </span>
      );
    case 'engineer':
      return (
        <span>
          You are <span className="seat-engineer">ENGINEER</span> — W throttle · S brake ·
          Space handbrake
        </span>
      );
    case 'spectator':
      return <span>You are SPECTATOR — both seats are taken, enjoy the ride</span>;
  }
}

export function Hud({ client }: { client: GameClient }): JSX.Element | null {
  const s = useGameClient(client);

  if (s.phase === 'lobby') return null;
  if (s.phase === 'connecting' || s.phase === 'disconnected' || s.phase === 'error') {
    return (
      <div id="hud">
        {s.errorText ??
          (s.phase === 'disconnected'
            ? 'Disconnected from server. Refresh to try again.'
            : 'Connecting…')}
      </div>
    );
  }

  const partner = s.players.find((p) => p.role !== s.role && p.role !== 'spectator');
  return (
    <div id="hud">
      Room <span className="code">{s.roomCode}</span> — share this code (or the URL)
      <br />
      {s.role && <RoleLine role={s.role} />}
      {s.role !== 'spectator' && (
        <>
          <br />
          {partner ? `Partner: ${partner.name}` : 'Waiting for your partner to join…'}
        </>
      )}
      <br />
      Speed: {Math.round(s.speedKmh)} km/h · Ping: {Math.round(s.rttMs)} ms
      {s.race && (
        <>
          <br />
          Lap {s.race.lap} · Time {formatLap(s.race.currentLapMs)} · Last{' '}
          {formatLap(s.race.lastLapMs)} · Best {formatLap(s.race.bestLapMs)}
        </>
      )}
      {s.role !== 'spectator' && (
        <>
          <br />
          {s.swapPending
            ? 'Seat swap requested — waiting for your partner (Tab)…'
            : 'Press Tab to request a seat swap'}
        </>
      )}
    </div>
  );
}
