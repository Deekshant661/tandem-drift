# Tandem Drift — Architecture & Execution Plan

A browser-based cooperative multiplayer game where **two players control one vehicle**:
- **Pilot** seat: steering (left/right).
- **Engineer** seat: throttle, brake, handbrake.

Physics-based, chaotic, communication-driven. Production quality, maintainable, scalable.

---

## 1. Technology Stack (2026 recommendation)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript everywhere** (strict) | One language across client/server/shared; shared simulation & protocol code is the killer feature for a networked physics game. |
| Runtime | **Node.js 22 LTS** | Mature, huge ecosystem, first-class WebSocket support. |
| Package mgmt | **npm workspaces** monorepo | Zero extra tooling; ships with Node. |
| Physics | **planck.js** (Box2D port, TS) | Mature 2D physics, runs identically in Node and browser → same sim code for server authority and client prediction. Top-down car is a classic Box2D pattern. |
| Rendering | **PixiJS v8** | Mature, fast WebGL/WebGPU 2D renderer. Top-down 2D keeps physics tractable and art costs low; 3D (Three.js + Rapier) is deferred, not required by the design. |
| Transport | **WebSocket (`ws` on server)** | Universal, simple, reliable-ordered. WebRTC DataChannel/WebTransport deferred (complexity ≫ benefit at our tick rates). |
| Client build | **Vite** | Standard, fast, boring. |
| Tests | **Vitest** | Fast, TS-native, one test runner for all packages. |
| Deployment | Docker container (server) + static hosting/CDN (client) | Stateless-ish game servers scale horizontally behind a room-aware gateway later. |

### Why not Rust for the server?
Rust would buy raw performance and memory safety — but our server load is dominated by a 2D physics step for a handful of vehicles per room. Node comfortably runs hundreds of rooms per core at 60 Hz for this workload. Rust would cost: a second language, no code sharing with the client (losing shared deterministic sim/protocol code), slower iteration, smaller hiring pool. **Rust is justified only when** per-room entity counts explode (large open worlds, 100+ physics bodies/room) or you need thousands of rooms per instance. We keep the door open: the simulation lives in a pure `shared` package with a narrow interface, so a future Rust/WASM sim could slot in.

### Why not Colyseus?
Colyseus is a fine mature framework, but its schema-based delta sync is optimized for many independent entities. Our state is tiny (one vehicle + two inputs per room); a hand-rolled room manager over `ws` is ~300 lines, fully understood, dependency-light, and easier to reason about for latency work. Tradeoff: we own reconnection/matchmaking code ourselves — acceptable at this scope.

---

## 2. System Architecture

```
 Browser (Pilot)  ──┐                       ┌─ Room A ─ fixed-step sim (60Hz)
 Browser (Engineer)─┼── WSS ── Game Server ─┼─ Room B ─ ...
 Browser (...)    ──┘        (authoritative)└─ Room N
        │
   Static CDN (client bundle, assets)
```

### Authoritative server
The server owns the truth. Clients send **inputs only** (never positions). The server steps physics at a fixed 60 Hz and broadcasts **snapshots at 20 Hz**. This prevents cheating and, crucially for a *shared* vehicle, guarantees both players see one consistent car.

### Networking model & protocol
- JSON messages initially (debuggable); protocol isolated behind `encode/decode` in `shared/protocol.ts` so a binary codec (flatbuffers-style manual packing) can replace it without touching game code. Tradeoff: JSON costs bandwidth (~1–2 KB/s per client — fine), buys velocity.
- Message types: `hello/join/joined`, `seat` assignment, `input` (client→server, seq-numbered, sent at 30 Hz), `snapshot` (server→client, tick-stamped), `roomState` (players/seat changes), `ping/pong` for RTT.

### Game loop
- **Server:** fixed timestep 60 Hz accumulator loop (`setTimeout`-driven with drift correction). Inputs are buffered per seat and sampled each tick; latest-input-wins within a tick.
- **Client:** `requestAnimationFrame` render loop decoupled from network. Input sampled and sent at 30 Hz.

### State synchronization, interpolation, prediction
- **Interpolation (both players):** clients render the vehicle ~100 ms in the past, interpolating between the two snapshots straddling render time (standard snapshot interpolation). Smooth at 20 Hz snapshots even with jitter.
- **Prediction:** classic client-side prediction assumes *your* inputs fully determine your entity. Here the vehicle is driven by **two** players' inputs, so full prediction would mispredict constantly (you can't know your partner's input). Decision: **no positional prediction in M1–M2**; instead we do **local input feedback** (steering wheel/pedal UI reacts instantly) which hides most perceived latency. M4 adds optional *dual-input prediction with reconciliation* (predict with your input + partner's last-known input, smoothly reconcile against server snapshots) — measurable, bounded error because partner inputs change slowly relative to RTT.
- **Latency compensation:** RTT measured continuously; interpolation delay adapts to jitter. No lag-compensated hit detection needed (no shooting).

### Room management
- `RoomManager`: create room (6-char code), join by code, seat assignment (first = pilot, second = engineer, extras = spectators), seat swap, disconnect handling with a grace window for reconnection (token-based), empty-room GC.
- Horizontal scaling path: rooms are independent; a gateway/redis room-directory shards rooms across instances. Not built until needed.

### Physics integration
- Top-down car model in `shared/sim`: chassis body; per-tick we kill lateral velocity (tire grip), apply drive force from throttle, braking force, and steering as angular control; handbrake reduces lateral grip (drifting). Pure functions over a planck `World` → runs on server (authority) and later on client (prediction).
- Determinism note: planck is float-based, not bit-deterministic across engines — fine, because the server is authoritative and clients only interpolate/reconcile.

### Asset organization
`packages/client/public/assets/{sprites,audio,maps}`; maps as JSON (wall segments + checkpoints) loaded by both server (collision) and client (render) from `shared/maps`.

### Testing strategy
- **Unit:** protocol encode/decode round-trips; vehicle sim behavior (accelerates under throttle, stops under brake, drifts under handbrake); RoomManager lifecycle (join/seat/disconnect/GC).
- **Integration:** in-process server + real `ws` clients exercising join → input → snapshot flow.
- **Manual/perf later:** headless bot clients for soak testing.

### Deployment
- Server: single Docker image, `PORT` env, health endpoint. Client: `vite build` → static hosting. TLS terminated at the edge. CI: typecheck + test on every commit.

---

## 3. Folder structure

```
tandem-drift/
├── package.json               # npm workspaces root
├── tsconfig.base.json
├── plan.md
├── README.md
└── packages/
    ├── shared/                # zero-dependency-on-runtime code shared by both sides
    │   └── src/ { protocol.ts, constants.ts, sim/vehicle.ts, maps/ }
    ├── server/                # authoritative game server (ws)
    │   └── src/ { index.ts, gameRoom.ts, roomManager.ts, connection.ts }
    └── client/                # Vite + PixiJS app
        └── src/ { main.ts, net/, render/, input/, ui/ }
```

---

## 4. Milestones

1. **M1 — Core loop (this build):** monorepo; shared protocol + vehicle sim; authoritative server with rooms, seats, 60 Hz sim, 20 Hz snapshots; client with rendering, input, snapshot interpolation. Two browser tabs can drive one car together. Unit + integration tests.
2. **M2 — Game feel:** track walls, checkpoints, lap timing, camera follow, HUD (speed, seat, RTT), seat swap, sounds.
3. **M3 — Robustness:** reconnection tokens, spectators, binary protocol, adaptive interpolation delay, server metrics/health.
4. **M4 — Prediction & polish:** dual-input prediction + reconciliation, multiple maps, lobby UI, Docker + CI pipeline.
