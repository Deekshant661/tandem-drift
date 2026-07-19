import {
  INPUT_SEND_HZ,
  INTERPOLATION_DELAY_MS,
  type PlayerInfo,
  type RaceInfo,
  type Role,
} from '@tandem/shared';
import { Connection } from './net/connection.js';
import { SnapshotBuffer } from './net/interpolation.js';
import { KeyboardInput } from './input/keyboard.js';
import { Scene } from './render/scene.js';
import { EngineAudio } from './audio/engine.js';

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'ws://localhost:8080';
const RECONNECT_INTERVAL_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 15;

const hud = document.getElementById('hud')!;

function formatLap(ms: number | null): string {
  if (ms === null) return '—';
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}

function roleLabel(role: Role): string {
  switch (role) {
    case 'pilot':
      return '<span class="seat-pilot">PILOT</span> — steer with A/D';
    case 'engineer':
      return '<span class="seat-engineer">ENGINEER</span> — W throttle · S brake · Space handbrake';
    case 'spectator':
      return 'SPECTATOR — both seats are taken, enjoy the show';
  }
}

function renderHud(opts: {
  roomCode?: string;
  role?: Role;
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
  const role = opts.role ?? 'spectator';
  const partner = opts.players
    ?.filter((p) => p.role !== role && p.role !== 'spectator')
    .map((p) => p.name)[0];
  const race = opts.race;
  hud.innerHTML = [
    `Room <span class="code">${opts.roomCode ?? ''}</span> — share this code (or the URL)`,
    `You are ${roleLabel(role)}`,
    role !== 'spectator'
      ? partner
        ? `Partner: ${partner}`
        : 'Waiting for your partner to join…'
      : '',
    `Speed: ${Math.round(opts.speedKmh ?? 0)} km/h · Ping: ${Math.round(opts.rttMs ?? 0)} ms`,
    race
      ? `Lap ${race.lap} · Time ${formatLap(race.currentLapMs)} · Last ${formatLap(race.lastLapMs)} · Best ${formatLap(race.bestLapMs)}`
      : '',
    role !== 'spectator'
      ? opts.swapPending
        ? 'Seat swap requested — waiting for your partner (Tab)…'
        : 'Press Tab to request a seat swap'
      : '',
  ]
    .filter(Boolean)
    .join('<br>');
}

async function main(): Promise<void> {
  const scene = new Scene();
  await scene.init();

  const url = new URL(location.href);
  const name = url.searchParams.get('name') ?? `Player-${Math.floor(Math.random() * 1000)}`;

  const snapshots = new SnapshotBuffer(INTERPOLATION_DELAY_MS);
  snapshots.enableAdaptiveDelay();
  const keyboard = new KeyboardInput();
  const audio = new EngineAudio();

  let conn: Connection | null = null;
  let role: Role | null = null;
  let myRoom: string | undefined = url.searchParams.get('room')?.toUpperCase() ?? undefined;
  let players: PlayerInfo[] = [];
  let race: RaceInfo | undefined;
  let speedKmh = 0;
  let swapPending = false;
  let inputSeq = 0;
  let reconnectAttempts = 0;

  const tokenKey = (room: string): string => `tandem-token-${room}`;

  const refreshHud = (): void => {
    if (role) {
      renderHud({
        roomCode: myRoom,
        role,
        players,
        rttMs: conn?.rttMs ?? 0,
        speedKmh,
        race,
        swapPending,
      });
    }
  };

  function connect(): void {
    const c = new Connection(SERVER_URL);
    conn = c;

    c.onOpen(() => {
      const token = myRoom
        ? (sessionStorage.getItem(tokenKey(myRoom)) ?? undefined)
        : undefined;
      c.send({ type: 'join', roomCode: myRoom, name, token });
    });

    c.onClose(() => {
      role = null;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        renderHud({ status: 'Disconnected from server. Refresh to try again.' });
        return;
      }
      reconnectAttempts++;
      renderHud({
        status: `Connection lost — reconnecting (attempt ${reconnectAttempts})…`,
      });
      setTimeout(connect, RECONNECT_INTERVAL_MS);
    });

    c.onMessage((msg) => {
      switch (msg.type) {
        case 'joined':
          role = msg.role;
          myRoom = msg.roomCode;
          reconnectAttempts = 0;
          sessionStorage.setItem(tokenKey(msg.roomCode), msg.token);
          url.searchParams.set('room', msg.roomCode);
          history.replaceState(null, '', url);
          refreshHud();
          break;
        case 'joinError':
          renderHud({
            status:
              msg.reason === 'full'
                ? 'That room is full (including the spectator gallery).'
                : 'Room not found — check the code.',
          });
          break;
        case 'roomState':
          players = msg.players;
          refreshHud();
          break;
        case 'seatSwapped':
          role = msg.seat;
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
  }

  connect();

  // Audio needs a user gesture; Tab requests a seat swap.
  window.addEventListener('keydown', (e) => {
    audio.start();
    if (e.code === 'Tab') {
      e.preventDefault();
      if (!swapPending && role && role !== 'spectator') {
        swapPending = true;
        conn?.send({ type: 'swapSeats' });
        refreshHud();
      }
    }
  });

  // Fixed-rate input sender, decoupled from the render loop.
  setInterval(() => {
    if (!role || role === 'spectator') return;
    conn?.send({ type: 'input', seq: ++inputSeq, input: keyboard.read(role) });
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
