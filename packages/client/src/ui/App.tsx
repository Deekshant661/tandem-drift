import { memo, useEffect, useMemo, useState } from 'react';
import { getWorld } from '@tandem/shared';
import { GameClient } from '../game/client.js';
import { useGameClient } from '../game/store.js';
import { GameCanvas } from '../scene/GameCanvas.js';
import { Lobby } from './Lobby.js';
import { Hud } from './Hud.js';
import { Minimap } from './Minimap.js';
import { PauseMenu } from './PauseMenu.js';
import { PerfOverlay } from './PerfOverlay.js';
import { RecoveryOverlay } from './RecoveryOverlay.js';
import { StuckPrompt } from './StuckPrompt.js';

// Memoized so the entire 3D scene only re-renders when `client` or `world`
// actually change (rarely) — not on every ~20Hz GameClient state tick, which
// would otherwise re-run React's reconciliation over the whole scene graph.
const MemoGameCanvas = memo(GameCanvas);
const MemoMinimap = memo(Minimap);

export function App(): JSX.Element {
  const client = useMemo(() => new GameClient(), []);
  useEffect(() => () => client.dispose(), [client]);
  const state = useGameClient(client);
  // getWorld() builds a fresh WorldMap object every call. Memoizing on
  // mapName (not recomputing per render) is what lets RoadMesh/Gates/
  // Environment's own useMemo(..., [world]) actually cache — without this,
  // every snapshot triggered a full road + scenery rebuild from scratch.
  const world = useMemo(() => (state.mapName ? getWorld(state.mapName) : null), [state.mapName]);
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
          <MemoGameCanvas client={client} world={world} />
          <MemoMinimap client={client} world={world} />
        </>
      )}
      {state.phase === 'playing' && !world && (
        <div className="notice">
          This room plays a legacy 2D map — create a Willowbrook room to see the 3D world.
        </div>
      )}
      <Hud client={client} />
      <PerfOverlay />
      {state.phase === 'playing' && state.role && state.role !== 'spectator' && (
        <>
          <RecoveryOverlay client={client} />
          <StuckPrompt client={client} />
        </>
      )}
      {paused && state.phase === 'playing' && (
        <PauseMenu client={client} onResume={() => setPaused(false)} />
      )}
    </>
  );
}
