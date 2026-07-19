import { useSyncExternalStore } from 'react';
import type { GameClient, GameState } from './client.js';

/** Subscribe a React component to the GameClient's coarse state. */
export function useGameClient(client: GameClient): GameState {
  return useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.getState(),
  );
}
