import {
  getWorld,
  INPUT_SEND_HZ,
  INTERPOLATION_DELAY_MS,
  worldToTrackMap,
  getMap,
  type PlayerInfo,
  type RaceInfo,
  type Role,
  type VehicleSnapshot,
} from '@tandem/shared';
import { Connection } from '../net/connection.js';
import { SnapshotBuffer } from '../net/interpolation.js';
import { Predictor } from '../net/prediction.js';
import { KeyboardInput } from '../input/keyboard.js';
import { EngineAudio } from '../audio/engine.js';

const SERVER_URL =
  (import.meta.env?.VITE_SERVER_URL as string | undefined) ?? 'ws://localhost:8080';
const RECONNECT_INTERVAL_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 15;

export interface GameState {
  phase: 'lobby' | 'connecting' | 'playing' | 'disconnected' | 'error';
  errorText: string | null;
  roomCode?: string;
  role: Role | null;
  players: PlayerInfo[];
  race?: RaceInfo;
  rttMs: number;
  speedKmh: number;
  swapPending: boolean;
  mapName: string | null;
}

interface GameClientOpts {
  createConnection?: (url: string) => Connection;
}

/**
 * All networking + game state, decoupled from rendering. React reads it via
 * useSyncExternalStore; the 3D scene reads the per-frame vehicle pose from
 * `poseRef` (mutable, never part of React state).
 */
export class GameClient {
  readonly poseRef: { current: VehicleSnapshot | null } = { current: null };

  private state: GameState = {
    phase: 'lobby',
    errorText: null,
    role: null,
    players: [],
    rttMs: 0,
    speedKmh: 0,
    swapPending: false,
    mapName: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly createConnection: (url: string) => Connection;

  private conn: Connection | null = null;
  private snapshots = new SnapshotBuffer(INTERPOLATION_DELAY_MS);
  private predictor: Predictor | null = null;
  private readonly keyboard: KeyboardInput | null;
  private readonly audio: EngineAudio | null;
  private joinOpts: { name: string; roomCode?: string; map: string } | null = null;
  private inputSeq = 0;
  private reconnectAttempts = 0;
  private inputTimer: ReturnType<typeof setInterval> | null = null;
  private hudTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: GameClientOpts = {}) {
    this.createConnection = opts.createConnection ?? ((url) => new Connection(url));
    const hasDom = typeof window !== 'undefined';
    this.keyboard = hasDom ? new KeyboardInput() : null;
    this.audio = hasDom ? new EngineAudio() : null;
    this.snapshots.enableAdaptiveDelay();

    if (hasDom) {
      window.addEventListener('keydown', (e) => {
        this.audio?.start();
        if (e.code === 'Tab') {
          e.preventDefault();
          this.requestSwap();
        }
      });
      // If the URL carries a room code (shared link), auto-join.
      const urlRoom = new URL(location.href).searchParams.get('room');
      if (urlRoom) {
        const name =
          new URL(location.href).searchParams.get('name') ??
          `Player-${Math.floor(Math.random() * 1000)}`;
        queueMicrotask(() =>
          this.join({ name, roomCode: urlRoom.toUpperCase(), map: 'willowbrook' }),
        );
      }
    }
  }

  getState(): GameState {
    return this.state;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(partial: Partial<GameState>): void {
    this.state = { ...this.state, ...partial };
    for (const fn of this.listeners) fn();
  }

  join(opts: { name: string; roomCode?: string; map: string }): void {
    if (this.state.phase === 'connecting' || this.state.phase === 'playing') return;
    this.joinOpts = opts;
    this.setState({ phase: 'connecting', errorText: null, roomCode: opts.roomCode });
    this.connect();
  }

  requestSwap(): void {
    const { role, swapPending, phase } = this.state;
    if (phase !== 'playing' || swapPending || !role || role === 'spectator') return;
    this.setState({ swapPending: true });
    this.conn?.send({ type: 'swapSeats' });
  }

  /** Sample predictor/interpolation into poseRef; called from useFrame. */
  samplePose(nowMs: number): void {
    this.poseRef.current = this.predictor?.sample() ?? this.snapshots.sample(nowMs);
  }

  private tokenKey(room: string): string {
    return `tandem-token-${room}`;
  }

  private connect(): void {
    const opts = this.joinOpts;
    if (!opts) return;
    const c = this.createConnection(SERVER_URL);
    this.conn = c;

    c.onOpen(() => {
      const room = this.state.roomCode ?? opts.roomCode;
      const token =
        room && typeof sessionStorage !== 'undefined'
          ? (sessionStorage.getItem(this.tokenKey(room)) ?? undefined)
          : undefined;
      c.send({ type: 'join', roomCode: room, name: opts.name, token, map: opts.map });
    });

    c.onClose(() => {
      this.predictor = null;
      if (this.state.phase === 'lobby' || this.state.phase === 'error') return;
      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.setState({ phase: 'disconnected', role: null });
        return;
      }
      this.reconnectAttempts++;
      this.setState({
        phase: 'connecting',
        role: null,
        errorText: `Connection lost — reconnecting (attempt ${this.reconnectAttempts})…`,
      });
      setTimeout(() => this.connect(), RECONNECT_INTERVAL_MS);
    });

    c.onMessage((msg) => {
      switch (msg.type) {
        case 'joined': {
          this.reconnectAttempts = 0;
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(this.tokenKey(msg.roomCode), msg.token);
          }
          if (typeof history !== 'undefined') {
            const url = new URL(location.href);
            url.searchParams.set('room', msg.roomCode);
            history.replaceState(null, '', url);
          }
          // Legacy 2D maps have no world; the predictor still needs the
          // TrackMap-equivalent physics — build from world when available.
          const world = getWorld(msg.map);
          const trackMap = world ? worldToTrackMap(world) : getMap(msg.map);
          this.predictor =
            msg.role !== 'spectator' ? new Predictor(trackMap, msg.role) : null;
          this.setState({
            phase: 'playing',
            errorText: null,
            roomCode: msg.roomCode,
            role: msg.role,
            mapName: msg.map,
          });
          this.startLoops();
          break;
        }
        case 'joinError':
          this.setState({
            phase: 'error',
            errorText:
              msg.reason === 'full'
                ? 'That room is full (including the spectator gallery).'
                : 'Room not found — check the code.',
          });
          break;
        case 'roomState':
          this.setState({ players: msg.players });
          break;
        case 'seatSwapped':
          this.predictor?.setSeat(msg.seat);
          this.setState({ role: msg.seat, swapPending: false });
          break;
        case 'snapshot': {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          this.snapshots.push(now, msg.vehicle);
          this.predictor?.onSnapshot(msg);
          this.setState({
            race: msg.race,
            speedKmh: Math.hypot(msg.vehicle.vx, msg.vehicle.vy) * 3.6,
          });
          break;
        }
      }
    });
  }

  private startLoops(): void {
    if (this.inputTimer) return;
    this.inputTimer = setInterval(() => {
      const { role, phase } = this.state;
      if (phase !== 'playing' || !role || role === 'spectator' || !this.keyboard) return;
      const input = this.keyboard.read(role);
      this.conn?.send({ type: 'input', seq: ++this.inputSeq, input });
      this.predictor?.addLocalInput(this.inputSeq, input);
    }, 1000 / INPUT_SEND_HZ);
    this.hudTimer = setInterval(() => {
      this.setState({ rttMs: this.conn?.rttMs ?? 0 });
      this.audio?.update(this.state.speedKmh / 3.6);
    }, 250);
  }

  /** Stop timers (tests / hot reload). */
  dispose(): void {
    if (this.inputTimer) clearInterval(this.inputTimer);
    if (this.hudTimer) clearInterval(this.hudTimer);
    this.inputTimer = null;
    this.hudTimer = null;
  }
}
