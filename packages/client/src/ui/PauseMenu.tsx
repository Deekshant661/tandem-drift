import type { GameClient } from '../game/client.js';

/**
 * Minimal pause menu (Esc). The simulation is server-side and never pauses —
 * this is a UI overlay. Settings ships disabled until persisted options exist.
 */
export function PauseMenu({
  client,
  onResume,
}: {
  client: GameClient;
  onResume: () => void;
}): JSX.Element {
  const leave = (): void => {
    client.audio?.click();
    const url = new URL(location.href);
    url.searchParams.delete('room');
    location.href = url.toString(); // reload → lobby, seat freed after grace
  };

  return (
    <div id="pause">
      <div className="pause-card">
        <h2>Paused</h2>
        <button
          onClick={() => {
            client.audio?.click();
            onResume();
          }}
        >
          Resume
        </button>
        <button onClick={leave}>Leave Room</button>
        <button disabled title="Coming soon">
          Settings
        </button>
        <button onClick={leave}>Back to Menu</button>
      </div>
    </div>
  );
}
