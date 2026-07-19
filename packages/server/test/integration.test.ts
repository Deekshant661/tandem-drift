import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import {
  decodeServerMsg,
  encode,
  type ClientMsg,
  type ServerMsg,
  type SnapshotMsg,
} from '@tandem/shared';
import { createGameServer, type GameServer } from '../src/server.js';

let server: GameServer;
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const s of sockets) s.terminate();
  sockets.length = 0;
  await server.close();
});

function start(): number {
  server = createGameServer();
  server.http.listen(0);
  return (server.http.address() as AddressInfo).port;
}

class TestClient {
  private readonly ws: WebSocket;
  private readonly queue: ServerMsg[] = [];
  private waiter: ((msg: ServerMsg) => void) | null = null;

  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    sockets.push(this.ws);
    this.ws.on('message', (raw) => {
      const msg = decodeServerMsg(raw.toString());
      if (!msg) return;
      if (this.waiter) {
        const w = this.waiter;
        this.waiter = null;
        w(msg);
      } else {
        this.queue.push(msg);
      }
    });
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
  }

  send(msg: ClientMsg): void {
    this.ws.send(encode(msg));
  }

  next(): Promise<ServerMsg> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timed out waiting for message')), 3000);
      this.waiter = (msg) => {
        clearTimeout(timeout);
        resolve(msg);
      };
    });
  }

  async nextOfType<T extends ServerMsg['type']>(type: T): Promise<Extract<ServerMsg, { type: T }>> {
    for (;;) {
      const msg = await this.next();
      if (msg.type === type) return msg as Extract<ServerMsg, { type: T }>;
    }
  }

  close(): void {
    this.ws.close();
  }
}

describe('server integration over real websockets', () => {
  it('runs the full join → input → snapshot flow for two players', async () => {
    const port = start();

    const pilot = new TestClient(port);
    await pilot.open();
    pilot.send({ type: 'join', name: 'Pilot' });
    const joined = await pilot.nextOfType('joined');
    expect(joined.seat).toBe('pilot');
    expect(joined.roomCode).toMatch(/^[A-Z2-9]{6}$/);

    const engineer = new TestClient(port);
    await engineer.open();
    engineer.send({ type: 'join', name: 'Engineer', roomCode: joined.roomCode });
    const joined2 = await engineer.nextOfType('joined');
    expect(joined2.seat).toBe('engineer');
    expect(joined2.roomCode).toBe(joined.roomCode);

    const roster = await engineer.nextOfType('roomState');
    expect(roster.players).toHaveLength(2);

    // Engineer floors the throttle; the authoritative car must start moving
    // and both clients must receive advancing snapshots.
    engineer.send({
      type: 'input',
      seq: 1,
      input: { steer: 0, throttle: 1, brake: 0, handbrake: false },
    });

    let last: SnapshotMsg | null = null;
    let moved = false;
    for (let i = 0; i < 40 && !moved; i++) {
      const snap = await engineer.nextOfType('snapshot');
      if (last) expect(snap.tick).toBeGreaterThan(last.tick);
      last = snap;
      moved = Math.hypot(snap.vehicle.vx, snap.vehicle.vy) > 0.5;
    }
    expect(moved).toBe(true);
    expect(last!.inputs.engineer.throttle).toBe(1);

    const pilotSnap = await pilot.nextOfType('snapshot');
    expect(pilotSnap.vehicle).toBeDefined();
  });

  it('rejects joins to unknown and full rooms', async () => {
    const port = start();

    const ghost = new TestClient(port);
    await ghost.open();
    ghost.send({ type: 'join', name: 'Ghost', roomCode: 'ZZZZZZ' });
    expect((await ghost.nextOfType('joinError')).reason).toBe('not_found');

    const a = new TestClient(port);
    await a.open();
    a.send({ type: 'join', name: 'A' });
    const { roomCode } = await a.nextOfType('joined');
    const b = new TestClient(port);
    await b.open();
    b.send({ type: 'join', name: 'B', roomCode });
    await b.nextOfType('joined');

    const c = new TestClient(port);
    await c.open();
    c.send({ type: 'join', name: 'C', roomCode });
    expect((await c.nextOfType('joinError')).reason).toBe('full');
  });

  it('answers pings and survives malformed messages', async () => {
    const port = start();
    const client = new TestClient(port);
    await client.open();
    client.send({ type: 'join', name: 'P' });
    await client.nextOfType('joined');

    (client as unknown as { ws: WebSocket }).ws.send('garbage{{{');
    client.send({ type: 'ping', t: 12345 });
    expect((await client.nextOfType('pong')).t).toBe(12345);
  });
});
