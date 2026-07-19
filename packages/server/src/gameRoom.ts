import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  combineSeatInputs,
  createSimWorld,
  encode,
  NEUTRAL_INPUT,
  RaceTracker,
  getMap,
  sanitizeInput,
  setVehicleState,
  SIM_DT,
  SIM_HZ,
  SNAPSHOT_EVERY_TICKS,
  snapshotVehicle,
  stepSim,
  type ControlInput,
  type PlayerInfo,
  type Role,
  type Seat,
  type ServerMsg,
  type SimWorld,
} from '@tandem/shared';

/** A pose the vehicle can be recovered to: spawn, or the last passed gate. */
interface RecoveryPose {
  x: number;
  y: number;
  angle: number;
}

/** Minimum ticks between recoveries — stops spamming R from feeling broken. */
export const RECOVERY_COOLDOWN_TICKS = SIM_HZ; // 1 second

/** Defensive bound: no legitimate Willowbrook position is anywhere near this
 *  far out. Catches theoretical physics-tunneling bugs ("fell off the map")
 *  that the closed road walls should already prevent. */
export const OUT_OF_BOUNDS_RADIUS = 3000;

/** True if a position is implausibly far from the playable world. */
export function isOutOfBounds(x: number, y: number, limit = OUT_OF_BOUNDS_RADIUS): boolean {
  return Math.hypot(x, y) > limit;
}

export interface RoomPlayer {
  id: string;
  name: string;
  role: Role;
  socket: WebSocket;
  lastInputSeq: number;
  /** Reconnection token; presenting it on a future join reclaims the seat. */
  token: string;
}

/** A seated player who dropped; their seat is reserved until the grace expires. */
interface PendingReconnect {
  token: string;
  name: string;
  seat: Seat;
  timer: NodeJS.Timeout;
}

/** How long a dropped player's seat is held for reconnection. */
export const RECONNECT_GRACE_MS = 30_000;
export const MAX_SPECTATORS = 8;

/**
 * One room = one vehicle + two seated players + optional spectators.
 * Owns an authoritative fixed-step simulation loop (60 Hz) driven by a
 * drift-corrected setTimeout, broadcasting snapshots at 20 Hz.
 */
export class GameRoom {
  readonly code: string;
  private readonly map;
  private readonly sim: SimWorld;
  private readonly race: RaceTracker;
  private readonly swapRequests = new Set<string>();
  private readonly players = new Map<string, RoomPlayer>();
  private readonly pending = new Map<string, PendingReconnect>();
  private readonly inputs: Record<Seat, ControlInput> = {
    pilot: { ...NEUTRAL_INPUT },
    engineer: { ...NEUTRAL_INPUT },
  };
  private tick = 0;
  private timer: NodeJS.Timeout | null = null;
  private nextTickAt = 0;
  private readonly onEmpty: (room: GameRoom) => void;
  private recoveryPose: RecoveryPose;
  private lastRecoveryTick = -Infinity;

  constructor(code: string, onEmpty: (room: GameRoom) => void, mapName?: string) {
    this.code = code;
    this.onEmpty = onEmpty;
    this.map = getMap(mapName);
    this.sim = createSimWorld(this.map);
    this.race = new RaceTracker(this.map.checkpoints);
    this.recoveryPose = { ...this.map.spawn };
  }

  get mapName(): string {
    return this.map.name;
  }

  get playerCount(): number {
    return this.players.size;
  }

  get currentTick(): number {
    return this.tick;
  }

  private seatedPlayers(): RoomPlayer[] {
    return [...this.players.values()].filter((p) => p.role !== 'spectator');
  }

  private freeSeat(): Seat | null {
    // Seats held for a pending reconnect are not free.
    const taken = new Set<Seat>([
      ...this.seatedPlayers().map((p) => p.role as Seat),
      ...[...this.pending.values()].map((p) => p.seat),
    ]);
    if (!taken.has('pilot')) return 'pilot';
    if (!taken.has('engineer')) return 'engineer';
    return null;
  }

  /**
   * Add a connection. A free (non-reserved) seat is taken pilot-first;
   * otherwise the connection becomes a spectator. Throws when even the
   * spectator gallery is full.
   */
  addPlayer(id: string, name: string, socket: WebSocket): RoomPlayer {
    const seat = this.freeSeat();
    const role: Role = seat ?? 'spectator';
    if (role === 'spectator') {
      const spectators = this.players.size - this.seatedPlayers().length;
      if (spectators >= MAX_SPECTATORS) throw new Error('room full');
    }
    const player: RoomPlayer = {
      id,
      name,
      role,
      socket,
      lastInputSeq: -1,
      token: randomUUID(),
    };
    this.players.set(id, player);
    if (!this.timer) this.startLoop();
    return player;
  }

  /**
   * Reclaim a seat held by a reconnection token. Returns the restored player,
   * or null if the token is unknown or its grace period has expired.
   */
  reclaimSeat(token: string, newId: string, socket: WebSocket): RoomPlayer | null {
    const held = this.pending.get(token);
    if (!held) return null;
    clearTimeout(held.timer);
    this.pending.delete(token);
    const player: RoomPlayer = {
      id: newId,
      name: held.name,
      role: held.seat,
      socket,
      lastInputSeq: -1,
      token,
    };
    this.players.set(newId, player);
    if (!this.timer) this.startLoop();
    return player;
  }

  /**
   * Handle a dropped connection. Seated players get a reconnect grace during
   * which their seat is reserved; spectators are simply removed.
   */
  handleDisconnect(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    this.players.delete(id);
    this.swapRequests.delete(id);

    if (player.role !== 'spectator') {
      const seat = player.role;
      this.inputs[seat] = { ...NEUTRAL_INPUT };
      const timer = setTimeout(() => {
        this.pending.delete(player.token);
        this.maybeClose();
        if (this.players.size > 0) this.broadcastRoomState();
      }, RECONNECT_GRACE_MS);
      timer.unref?.();
      this.pending.set(player.token, { token: player.token, name: player.name, seat, timer });
    }

    this.maybeClose();
    if (this.players.size > 0) this.broadcastRoomState();
  }

  /** Remove a player immediately with no reconnect grace (e.g. explicit leave). */
  removePlayer(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    this.players.delete(id);
    this.swapRequests.delete(id);
    if (player.role !== 'spectator') this.inputs[player.role] = { ...NEUTRAL_INPUT };
    this.maybeClose();
    if (this.players.size > 0) this.broadcastRoomState();
  }

  /** The room dies only when nobody is connected and nobody can come back. */
  private maybeClose(): void {
    if (this.players.size > 0 || this.pending.size > 0) return;
    this.stopLoop();
    this.onEmpty(this);
  }

  /** Accept an input only for the sender's own seat; stale sequence numbers are dropped. */
  applyInput(playerId: string, seq: number, input: ControlInput): void {
    const player = this.players.get(playerId);
    if (!player || player.role === 'spectator' || seq <= player.lastInputSeq) return;
    player.lastInputSeq = seq;
    this.inputs[player.role] = sanitizeInput(input);
  }

  /**
   * Register a seat-swap request. The swap executes only when both seated
   * players have requested it (mutual consent — one player can't yank the
   * wheel away mid-corner). Both seats' controls reset to neutral on swap.
   */
  requestSeatSwap(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.role === 'spectator') return;
    this.swapRequests.add(playerId);
    const seated = this.seatedPlayers();
    if (seated.length < 2 || !seated.every((p) => this.swapRequests.has(p.id))) return;

    this.swapRequests.clear();
    for (const p of seated) {
      p.role = p.role === 'pilot' ? 'engineer' : 'pilot';
    }
    this.inputs.pilot = { ...NEUTRAL_INPUT };
    this.inputs.engineer = { ...NEUTRAL_INPUT };
    for (const p of seated) {
      if (p.socket.readyState === p.socket.OPEN) {
        p.socket.send(encode({ type: 'seatSwapped', seat: p.role as Seat }));
      }
    }
    this.broadcastRoomState();
  }

  /**
   * Respawn the vehicle at the last passed checkpoint (or spawn, if none has
   * been passed yet), facing the correct direction, at rest. Rate-limited so
   * a stuck-key or double-press can't spam resets. Any seated player can
   * trigger it — this is a "we're stuck, let's continue" affordance, not a
   * privileged action.
   */
  requestRecover(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.role === 'spectator') return;
    if (this.tick - this.lastRecoveryTick < RECOVERY_COOLDOWN_TICKS) return;
    this.applyRecovery('manual');
  }

  private applyRecovery(reason: 'manual' | 'out_of_bounds'): void {
    setVehicleState(this.sim, {
      x: this.recoveryPose.x,
      y: this.recoveryPose.y,
      angle: this.recoveryPose.angle,
      vx: 0,
      vy: 0,
      angularVelocity: 0,
    });
    this.lastRecoveryTick = this.tick;
    this.broadcast({ type: 'recovered', vehicle: snapshotVehicle(this.sim), reason });
  }

  getPlayers(): PlayerInfo[] {
    return [...this.players.values()].map(({ id, role, name }) => ({ id, role, name }));
  }

  private startLoop(): void {
    this.nextTickAt = Date.now();
    const pump = (): void => {
      // Drift-corrected fixed step: catch up if the event loop stalled,
      // capped to avoid a spiral of death after a long pause.
      let steps = 0;
      while (Date.now() >= this.nextTickAt && steps < SIM_HZ) {
        this.stepOnce();
        this.nextTickAt += 1000 / SIM_HZ;
        steps++;
      }
      if (steps === SIM_HZ) this.nextTickAt = Date.now();
      this.timer = setTimeout(pump, Math.max(0, this.nextTickAt - Date.now()));
    };
    this.timer = setTimeout(pump, 0);
  }

  private stopLoop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private stepOnce(): void {
    stepSim(this.sim, combineSeatInputs(this.inputs.pilot, this.inputs.engineer), SIM_DT);
    this.tick++;
    const vehicle = snapshotVehicle(this.sim);

    // Safety net: no legitimate position should ever be this far out — if it
    // happens (a physics-tunneling edge case, since the closed road walls
    // should already prevent it), recover automatically instead of leaving
    // the car lost off-world.
    if (isOutOfBounds(vehicle.x, vehicle.y)) {
      this.applyRecovery('out_of_bounds');
      return;
    }

    const prevNextGate = this.race.state(this.tick).nextCheckpoint;
    this.race.update(vehicle.x, vehicle.y, this.tick);
    const newNextGate = this.race.state(this.tick).nextCheckpoint;
    if (newNextGate !== prevNextGate && prevNextGate >= 0) {
      // The gate at prevNextGate index was just passed — bank it as the
      // recovery point (angle included, so recovering faces the right way).
      const passed = this.map.checkpoints[prevNextGate];
      if (passed) this.recoveryPose = { x: passed.x, y: passed.y, angle: passed.angle };
    }

    if (this.tick % SNAPSHOT_EVERY_TICKS === 0) {
      const ack = { pilot: -1, engineer: -1 };
      for (const p of this.seatedPlayers()) ack[p.role as Seat] = p.lastInputSeq;
      this.broadcast({
        type: 'snapshot',
        tick: this.tick,
        vehicle,
        inputs: { pilot: this.inputs.pilot, engineer: this.inputs.engineer },
        ack,
        race: this.race.state(this.tick),
      });
    }
  }

  /** Announce the current roster to everyone. Callers invoke this after the
   *  joiner has received its own `joined` message, so roster updates never
   *  arrive before identity. */
  broadcastRoomState(): void {
    this.broadcast({ type: 'roomState', players: this.getPlayers() });
  }

  private broadcast(msg: ServerMsg): void {
    const data = encode(msg);
    for (const p of this.players.values()) {
      if (p.socket.readyState === p.socket.OPEN) p.socket.send(data);
    }
  }
}
