import { useState } from 'react';
import type { GameClient } from '../game/client.js';

const MAPS = [
  { value: 'fernvale', label: 'Fernvale — handcrafted showcase drive (3D)' },
  { value: 'willowbrook', label: 'Willowbrook — cozy countryside (3D)' },
  { value: 'track01', label: 'First Date — classic circuit (2D legacy)' },
  { value: 'track02', label: 'The Squeeze — narrow circuit (2D legacy)' },
];

export function Lobby({ client }: { client: GameClient }): JSX.Element {
  const [name, setName] = useState('');
  const [map, setMap] = useState('fernvale');
  const [code, setCode] = useState('');

  const playerName = (): string =>
    name.trim() || `Player-${Math.floor(Math.random() * 1000)}`;

  const create = (): void => {
    client.audio?.click();
    client.join({ name: playerName(), map });
  };
  const join = (): void => {
    const roomCode = code.trim().toUpperCase();
    if (roomCode.length === 6) {
      client.audio?.click();
      client.join({ name: playerName(), roomCode, map });
    }
  };

  return (
    <div id="lobby">
      <form onSubmit={(e) => e.preventDefault()}>
        <h1>Tandem Drift</h1>
        <p className="hint">Two players, one car. Pilot steers; engineer drives.</p>
        <label>
          Your name
          <input
            id="player-name"
            maxLength={24}
            placeholder="Player"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Map (when creating)
          <select id="map-select" value={map} onChange={(e) => setMap(e.target.value)}>
            {MAPS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button id="create-btn" type="button" onClick={create}>
          Create room
        </button>
        <label>
          …or join with a code
          <input
            id="room-code"
            maxLength={6}
            placeholder="ABC123"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                join();
              }
            }}
          />
        </label>
        <button id="join-btn" type="button" onClick={join}>
          Join room
        </button>
      </form>
    </div>
  );
}
