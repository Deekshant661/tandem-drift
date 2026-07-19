import {
  INPUT_SEND_HZ,
  INTERPOLATION_DELAY_MS,
  type PlayerInfo,
  type RaceInfo,
  type Seat,
} from '@tandem/shared';
import { Connection } from './net/connection.js';
import { SnapshotBuffer } from './net/interpolation.js';
import { KeyboardInput } from './input/keyboard.js';
import { Scene } from './render/scene.js';
import { EngineAudio } from './audio/engine.js';

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'ws://localhost:8080';

const hud = document.getElementById('hud')!;

function formatLap(ms: number | null): string {
  if (ms === null) return '—';
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}

function renderHud(opts: {
  roomCode?: string;
  seat?: Seat;
  players?: PlayerInfo[];
  rttMs?: number;
  speedKmh?: number;
  race?: RaceInfo;
  swapPending?: boolean;
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
  const race = opts.race;
  hud.innerHTML = [
    `Room <span class="code">${opts.roomCode ?? ''}</span> — share this code (or the URL)`,
    `You are ${seatLabel}`,
    partner ? `Partner: ${partner}` : 'Waiting for your partner to join…',
    `Speed: ${Math.round(opts.speedKmh ?? 0)} km/h · Ping: ${Math.round(opts.rttMs ?? 0)} ms`,
    race
      ? `Lap ${race.lap} · Time ${formatLap(race.currentLapMs)} · Last ${formatLap(race.lastLapMs)} · Best ${formatLap(race.bestLapMs)}`
      : '',
    opts.swapPending
      ? 'Seat swap requested — waiting for your partner (Tab)…'
      : 'Press Tab to request a seat swap',
  ]
    .filter(Boolean)
    .join('<br>');
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
  const audio = new EngineAudio();

  let seat: Seat | null = null;
  let myRoom: string | undefined;
  let players: PlayerInfo[] = [];
  let race: RaceInfo | undefined;
  let speedKmh = 0;
  let swapPending = false;
  let inputSeq = 0;

  const refreshHud = (): void => {
    if (seat) renderHud({ roomCode: myRoom, seat, players, rttMs: conn.rttMs, speedKmh, race, swapPending });
  };

  conn.onOpen(() => conn.send({ type: 'join', roomCode, name }));
  conn.onClose(() => renderHud({ status: 'Disconnected from server. Refresh to reconnect.' }));

  conn.onMessage((msg) => {
    switch (msg.type) {
      case 'joined':
        seat = msg.seat;
        myRoom = msg.roomCode;
        url.searchParams.set('room', msg.roomCode);
        history.replaceState(null, '', url);
        refreshHud();
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
        refreshHud();
        break;
      case 'seatSwapped':
        seat = msg.seat;
        swapPending = false;
        refreshHud();
        break;
      case 'snapshot':
        snapshots.push(performance.now(), msg.vehicle);
        race = msg.race;
        speedKmh = Math.hypot(msg.vehicle.vx, msg.vehicle.vy) * 3.6;
        scene.setActiveGate(msg.race.nextCheckpoint);
        break;
    }
  });

  // Audio needs a user gesture; Tab requests a seat swap.
  window.addEventListener('keydown', (e) => {
    audio.start();
    if (e.code === 'Tab') {
      e.preventDefault();
      if (!swapPending) {
        swapPending = true;
        conn.send({ type: 'swapSeats' });
        refreshHud();
      }
    }
  });

  // Fixed-rate input sender, decoupled from the render loop.
  setInterval(() => {
    if (!seat) return;
    conn.send({ type: 'input', seq: ++inputSeq, input: keyboard.read(seat) });
  }, 1000 / INPUT_SEND_HZ);

  // HUD + engine audio refresh.
  setInterval(() => {
    refreshHud();
    audio.update(speedKmh / 3.6);
  }, 250);

  scene.app.ticker.add(() => {
    const state = snapshots.sample(performance.now());
    if (state) scene.update(state);
  });
}

void main();
