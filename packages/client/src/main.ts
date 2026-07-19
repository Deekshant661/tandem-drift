import {
  INPUT_SEND_HZ,
  INTERPOLATION_DELAY_MS,
  type PlayerInfo,
  type Seat,
} from '@tandem/shared';
import { Connection } from './net/connection.js';
import { SnapshotBuffer } from './net/interpolation.js';
import { KeyboardInput } from './input/keyboard.js';
import { Scene } from './render/scene.js';

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'ws://localhost:8080';

const hud = document.getElementById('hud')!;

function renderHud(opts: {
  roomCode?: string;
  seat?: Seat;
  players?: PlayerInfo[];
  rttMs?: number;
  status?: string;
}): void {
  if (opts.status) {
    hud.textContent = opts.status;
    return;
  }
  const seatLabel =
    opts.seat === 'pilot'
      ? '<span class="seat-pilot">PILOT</span> — steer with A/D'
      : '<span class="seat-engineer">ENGINEER</span> — W throttle · S brake · Space handbrake';
  const partner = opts.players?.filter((p) => p.seat !== opts.seat).map((p) => p.name)[0];
  hud.innerHTML = [
    `Room <span class="code">${opts.roomCode ?? ''}</span> — share this code (or the URL)`,
    `You are ${seatLabel}`,
    partner ? `Partner: ${partner}` : 'Waiting for your partner to join…',
    `Ping: ${Math.round(opts.rttMs ?? 0)} ms`,
  ].join('<br>');
}

async function main(): Promise<void> {
  const scene = new Scene();
  await scene.init();

  const url = new URL(location.href);
  const roomCode = url.searchParams.get('room')?.toUpperCase() ?? undefined;
  const name = url.searchParams.get('name') ?? `Player-${Math.floor(Math.random() * 1000)}`;

  const conn = new Connection(SERVER_URL);
  const snapshots = new SnapshotBuffer(INTERPOLATION_DELAY_MS);
  const keyboard = new KeyboardInput();

  let seat: Seat | null = null;
  let myRoom: string | undefined;
  let players: PlayerInfo[] = [];
  let inputSeq = 0;

  conn.onOpen(() => conn.send({ type: 'join', roomCode, name }));
  conn.onClose(() => renderHud({ status: 'Disconnected from server. Refresh to reconnect.' }));

  conn.onMessage((msg) => {
    switch (msg.type) {
      case 'joined':
        seat = msg.seat;
        myRoom = msg.roomCode;
        url.searchParams.set('room', msg.roomCode);
        history.replaceState(null, '', url);
        renderHud({ roomCode: myRoom, seat, players, rttMs: conn.rttMs });
        break;
      case 'joinError':
        renderHud({
          status:
            msg.reason === 'full'
              ? 'That room already has two players.'
              : 'Room not found — check the code.',
        });
        break;
      case 'roomState':
        players = msg.players;
        if (seat) renderHud({ roomCode: myRoom, seat, players, rttMs: conn.rttMs });
        break;
      case 'snapshot':
        snapshots.push(performance.now(), msg.vehicle);
        break;
    }
  });

  // Fixed-rate input sender, decoupled from the render loop.
  setInterval(() => {
    if (!seat) return;
    conn.send({ type: 'input', seq: ++inputSeq, input: keyboard.read(seat) });
  }, 1000 / INPUT_SEND_HZ);

  // HUD ping refresh.
  setInterval(() => {
    if (seat) renderHud({ roomCode: myRoom, seat, players, rttMs: conn.rttMs });
  }, 1000);

  scene.app.ticker.add(() => {
    const state = snapshots.sample(performance.now());
    if (state) scene.update(state);
  });
}

void main();
