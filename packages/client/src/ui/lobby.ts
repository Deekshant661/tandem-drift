export interface LobbyChoice {
  name: string;
  /** Undefined = create a new room. */
  roomCode?: string;
  /** Map for room creation. */
  map: string;
}

/**
 * Show the lobby overlay and resolve with the player's choice. If the URL
 * already carries a room code (shared link), the lobby is skipped entirely.
 */
export function runLobby(): Promise<LobbyChoice> {
  const url = new URL(location.href);
  const urlRoom = url.searchParams.get('room')?.toUpperCase();
  const urlName = url.searchParams.get('name');
  const lobby = document.getElementById('lobby')!;

  if (urlRoom) {
    lobby.remove();
    return Promise.resolve({
      name: urlName ?? `Player-${Math.floor(Math.random() * 1000)}`,
      roomCode: urlRoom,
      map: 'track01',
    });
  }

  const nameInput = document.getElementById('player-name') as HTMLInputElement;
  const mapSelect = document.getElementById('map-select') as HTMLSelectElement;
  const codeInput = document.getElementById('room-code') as HTMLInputElement;
  const createBtn = document.getElementById('create-btn') as HTMLButtonElement;
  const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
  if (urlName) nameInput.value = urlName;

  return new Promise((resolve) => {
    const finish = (roomCode?: string): void => {
      lobby.remove();
      resolve({
        name: nameInput.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`,
        roomCode,
        map: mapSelect.value,
      });
    };
    createBtn.addEventListener('click', () => finish(undefined));
    joinBtn.addEventListener('click', () => {
      const code = codeInput.value.trim().toUpperCase();
      if (code.length === 6) finish(code);
      else codeInput.focus();
    });
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        joinBtn.click();
      }
    });
  });
}
