import { createServer, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { decodeClientMsg, encode } from '@tandem/shared';
import { RoomManager } from './roomManager.js';
import type { GameRoom } from './gameRoom.js';

interface ConnectionState {
  playerId: string;
  room: GameRoom | null;
}

export interface GameServer {
  http: HttpServer;
  wss: WebSocketServer;
  rooms: RoomManager;
  close(): Promise<void>;
}

/** Create (but don't start) the game server. Call http.listen(port) to start. */
export function createGameServer(): GameServer {
  const rooms = new RoomManager();

  const startedAt = Date.now();
  const http = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          rooms: rooms.roomCount,
          players: rooms.playerCount,
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: http });

  wss.on('connection', (socket: WebSocket) => {
    const state: ConnectionState = { playerId: randomUUID(), room: null };

    socket.on('message', (raw) => {
      const msg = decodeClientMsg(raw.toString());
      if (!msg) return; // malformed traffic is dropped, not fatal

      switch (msg.type) {
        case 'join': {
          if (state.room) return; // already seated
          let room: GameRoom | undefined;
          if (msg.roomCode === undefined) {
            room = rooms.createRoom();
          } else {
            room = rooms.getRoom(msg.roomCode);
            if (!room) {
              socket.send(encode({ type: 'joinError', reason: 'not_found' }));
              return;
            }
          }
          const name = msg.name.trim().slice(0, 24) || 'Player';

          // A valid reconnection token reclaims the reserved seat; otherwise
          // this is a normal join (seat if available, spectator if not).
          let player =
            msg.token !== undefined
              ? room.reclaimSeat(msg.token, state.playerId, socket)
              : null;
          if (!player) {
            try {
              player = room.addPlayer(state.playerId, name, socket);
            } catch {
              socket.send(encode({ type: 'joinError', reason: 'full' }));
              return;
            }
          }
          state.room = room;
          socket.send(
            encode({
              type: 'joined',
              roomCode: room.code,
              playerId: player.id,
              role: player.role,
              tick: room.currentTick,
              token: player.token,
            }),
          );
          room.broadcastRoomState();
          break;
        }
        case 'input':
          state.room?.applyInput(state.playerId, msg.seq, msg.input);
          break;
        case 'ping':
          socket.send(encode({ type: 'pong', t: msg.t }));
          break;
        case 'swapSeats':
          state.room?.requestSeatSwap(state.playerId);
          break;
      }
    });

    socket.on('close', () => {
      state.room?.handleDisconnect(state.playerId);
      state.room = null;
    });

    socket.on('error', () => socket.close());
  });

  return {
    http,
    wss,
    rooms,
    close: () =>
      new Promise((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => http.close(() => resolve()));
      }),
  };
}
