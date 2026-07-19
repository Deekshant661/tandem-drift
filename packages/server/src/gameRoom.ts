import type { WebSocket } from 'ws';
import {
  combineSeatInputs,
  createSimWorld,
  encode,
  NEUTRAL_INPUT,
  RaceTracker,
  track01,
  sanitizeInput,
  SIM_DT,
  SIM_HZ,
  SNAPSHOT_EVERY_TICKS,
  snapshotVehicle,
  stepSim,
  type ControlInput,
  type PlayerInfo,
  type Seat,
  type ServerMsg,
  type SimWorld,
} from '@tandem/shared';

export interface RoomPlayer {
  id: string;
  name: string;
  seat: Seat;
  socket: WebSocket;
  lastInputSeq: number;
}

/**
 * One room = one vehicle + up to two seated players.
 * Owns an authoritative fixed-step simulation loop (60 Hz) driven by a
 * drift-corrected setTimeout, broadcasting snapshots at 20 Hz.
 */
export class GameRoom {
  readonly code: string;
  private readonly map = track01();
  private readonly sim: SimWorld = createSimWorld(this.map);
  private readonly race = new RaceTracker(this.map.checkpoints);
  private readonly swapRequests = new Set<string>();
  private readonly players = new Map<string, RoomPlayer>();
  private readonly inputs: Record<Seat, ControlInput> = {
    pilot: { ...NEUTRAL_INPUT },
    engineer: { ...NEUTRAL_INPUT },
  };
  private tick = 0;
  private timer: NodeJS.Timeout | null = null;
  private nextTickAt = 0;
  private readonly onEmpty: (room: GameRoom) => void;

  constructor(code: string, onEmpty: (room: GameRoom) => void) {
    this.code = code;
    this.onEmpty = onEmpty;
  }

  get playerCount(): number {
    return this.players.size;
  }

  get currentTick(): number {
    return this.tick;
  }

  isFull(): boolean {
    return this.players.size >= 2;
  }

  /** Seat the player: first joiner pilots, second runs the engine. */
  addPlayer(id: string, name: string, socket: WebSocket): RoomPlayer {
    if (this.isFull()) throw new Error('room full');
    const takenSeats = new Set([...this.players.values()].map((p) => p.seat));
    const seat: Seat = takenSeats.has('pilot') ? 'engineer' : 'pilot';
    const player: RoomPlayer = { id, name, seat, socket, lastInputSeq: -1 };
    this.players.set(id, player);
    if (!this.timer) this.startLoop();
    return player;
  }

  removePlayer(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    this.players.delete(id);
    this.swapRequests.delete(id);
    // A departed seat's controls go neutral immediately.
    this.inputs[player.seat] = { ...NEUTRAL_INPUT };
    if (this.players.size === 0) {
      this.stopLoop();
      this.onEmpty(this);
    } else {
      this.broadcastRoomState();
    }
  }

  /** Accept an input only for the sender's own seat; stale sequence numbers are dropped. */
  applyInput(playerId: string, seq: number, input: ControlInput): void {
    const player = this.players.get(playerId);
    if (!player || seq <= player.lastInputSeq) return;
    player.lastInputSeq = seq;
    this.inputs[player.seat] = sanitizeInput(input);
  }

  /**
   * Register a seat-swap request. The swap executes only when both seated
   * players have requested it (mutual consent — one player can't yank the
   * wheel away mid-corner). Both seats' controls reset to neutral on swap.
   */
  requestSeatSwap(playerId: string): void {
    if (!this.players.has(playerId)) return;
    this.swapRequests.add(playerId);
    if (this.players.size < 2 || this.swapRequests.size < 2) return;

    this.swapRequests.clear();
    for (const p of this.players.values()) {
      p.seat = p.seat === 'pilot' ? 'engineer' : 'pilot';
    }
    this.inputs.pilot = { ...NEUTRAL_INPUT };
    this.inputs.engineer = { ...NEUTRAL_INPUT };
    for (const p of this.players.values()) {
      if (p.socket.readyState === p.socket.OPEN) {
        p.socket.send(encode({ type: 'seatSwapped', seat: p.seat }));
      }
    }
    this.broadcastRoomState();
  }

  getPlayers(): PlayerInfo[] {
    return [...this.players.values()].map(({ id, seat, name }) => ({ id, seat, name }));
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
    this.race.update(vehicle.x, vehicle.y, this.tick);
    if (this.tick % SNAPSHOT_EVERY_TICKS === 0) {
      this.broadcast({
        type: 'snapshot',
        tick: this.tick,
        vehicle,
        inputs: { pilot: this.inputs.pilot, engineer: this.inputs.engineer },
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
