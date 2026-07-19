import { useEffect, useMemo, useState } from 'react';
import { getWorld } from '@tandem/shared';
import { GameClient } from '../game/client.js';
import { useGameClient } from '../game/store.js';
import { GameCanvas } from '../scene/GameCanvas.js';
import { Lobby } from './Lobby.js';
import { Hud } from './Hud.js';
import { Minimap } from './Minimap.js';
import { PauseMenu } from './PauseMenu.js';

export function App(): JSX.Element {
  const client = useMemo(() => new GameClient(), []);
  useEffect(() => () => client.dispose(), [client]);
  const state = useGameClient(client);
  const world = state.mapName ? getWorld(state.mapName) : null;
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {state.phase === 'lobby' && <Lobby client={client} />}
      {state.phase === 'playing' && world && (
        <>
          <GameCanvas client={client} world={world} />
          <Minimap client={client} world={world} />
        </>
      )}
      {state.phase === 'playing' && !world && (
        <div className="notice">
          This room plays a legacy 2D map — create a Willowbrook room to see the 3D world.
        </div>
      )}
      <Hud client={client} />
      {paused && state.phase === 'playing' && (
        <PauseMenu client={client} onResume={() => setPaused(false)} />
      )}
    </>
  );
}
