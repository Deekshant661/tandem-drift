/**
 * Wire protocol. JSON for now; all traffic goes through encode/decode so a
 * binary codec can replace this module without touching game code.
 */

export type Seat = 'pilot' | 'engineer';

/** Full control input. The server only reads the fields owned by the sender's seat. */
export interface ControlInput {
  /** -1 (full left) .. 1 (full right). Pilot seat. */
  steer: number;
  /** 0..1. Engineer seat. */
  throttle: number;
  /** 0..1. Engineer seat. */
  brake: number;
  /** Engineer seat. */
  handbrake: boolean;
}

export interface VehicleSnapshot {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  angularVelocity: number;
}

export interface PlayerInfo {
  id: string;
  seat: Seat;
  name: string;
}

// ---- client -> server ----

export interface JoinMsg {
  type: 'join';
  /** Omit to create a new room. */
  roomCode?: string;
  name: string;
}

export interface InputMsg {
  type: 'input';
  seq: number;
  input: ControlInput;
}

export interface PingMsg {
  type: 'ping';
  t: number;
}

/** Request to swap seats; takes effect when both players have requested it. */
export interface SwapSeatsMsg {
  type: 'swapSeats';
}

export type ClientMsg = JoinMsg | InputMsg | PingMsg | SwapSeatsMsg;

// ---- server -> client ----

export interface JoinedMsg {
  type: 'joined';
  roomCode: string;
  playerId: string;
  seat: Seat;
  tick: number;
}

export interface JoinErrorMsg {
  type: 'joinError';
  reason: 'not_found' | 'full' | 'bad_request';
}

export interface RoomStateMsg {
  type: 'roomState';
  players: PlayerInfo[];
}

export interface RaceInfo {
  lap: number;
  nextCheckpoint: number;
  currentLapMs: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
}

export interface SnapshotMsg {
  type: 'snapshot';
  tick: number;
  vehicle: VehicleSnapshot;
  /** Last applied inputs, so each client can show the partner's controls. */
  inputs: { pilot: ControlInput; engineer: ControlInput };
  race: RaceInfo;
}

/** Sent when a pending both-players seat swap completes. */
export interface SeatSwappedMsg {
  type: 'seatSwapped';
  /** Your new seat, per recipient. */
  seat: Seat;
}

export interface PongMsg {
  type: 'pong';
  t: number;
}

export type ServerMsg =
  | JoinedMsg
  | JoinErrorMsg
  | RoomStateMsg
  | SnapshotMsg
  | PongMsg
  | SeatSwappedMsg;

// ---- codec ----

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

const CLIENT_TYPES = new Set(['join', 'input', 'ping', 'swapSeats']);
const SERVER_TYPES = new Set([
  'joined',
  'joinError',
  'roomState',
  'snapshot',
  'pong',
  'seatSwapped',
]);

function parse(data: string, allowed: Set<string>): unknown | null {
  let obj: unknown;
  try {
    obj = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const type = (obj as { type?: unknown }).type;
  if (typeof type !== 'string' || !allowed.has(type)) return null;
  return obj;
}

/** Decode a message received by the server. Returns null on malformed input. */
export function decodeClientMsg(data: string): ClientMsg | null {
  const obj = parse(data, CLIENT_TYPES) as ClientMsg | null;
  if (!obj) return null;
  if (obj.type === 'input') {
    const i = obj.input as unknown;
    if (typeof i !== 'object' || i === null) return null;
    const c = i as Record<string, unknown>;
    if (
      typeof c.steer !== 'number' ||
      typeof c.throttle !== 'number' ||
      typeof c.brake !== 'number' ||
      typeof c.handbrake !== 'boolean' ||
      typeof obj.seq !== 'number'
    ) {
      return null;
    }
  }
  if (obj.type === 'join' && typeof obj.name !== 'string') return null;
  if (obj.type === 'ping' && typeof obj.t !== 'number') return null;
  return obj;
}

/** Decode a message received by the client. Returns null on malformed input. */
export function decodeServerMsg(data: string): ServerMsg | null {
  return parse(data, SERVER_TYPES) as ServerMsg | null;
}

/** Clamp an input to its legal ranges (server-side sanitization). */
export function sanitizeInput(input: ControlInput): ControlInput {
  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;
  return {
    steer: clamp(input.steer, -1, 1),
    throttle: clamp(input.throttle, 0, 1),
    brake: clamp(input.brake, 0, 1),
    handbrake: !!input.handbrake,
  };
}

export const NEUTRAL_INPUT: ControlInput = {
  steer: 0,
  throttle: 0,
  brake: 0,
  handbrake: false,
};
