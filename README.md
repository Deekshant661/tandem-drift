# Tandem Drift

A browser-based cooperative multiplayer game where **two players drive one car**:
the **pilot** steers, the **engineer** works the throttle, brake, and handbrake.
Physics-based, server-authoritative, chaos guaranteed — now in **3D**: a React
Three Fiber chase-camera view over the flat authoritative 2D sim, driving the
cozy countryside loop of **Willowbrook** (Phase 2, see `phase2.md`).

See [plan.md](plan.md) for the full architecture, tradeoffs, and milestone roadmap.

## Quick start

```bash
npm install
npm run dev:server    # authoritative game server on :8080
npm run dev:client    # Vite dev server on :5173 (separate terminal)
```

Open http://localhost:5173 — pick a name and track in the lobby and create a
room; its code appears in the HUD (and in the URL). Open the same URL in a
second tab/browser to take the second seat.

**Controls** — Pilot: `A`/`D` steer. Engineer: `W` throttle, `S` brake, `Space` handbrake.
`Tab` requests a seat swap (executes when both players request it).

**Racing** — the room runs the "First Date" circuit: pass the glowing green gate
next; lapping the yellow start/finish gate records last/best lap times in the HUD.

**Tracks** — "First Date" (wide, friendly) and "The Squeeze" (narrow, mean),
chosen in the lobby when creating a room.

**Prediction** — seated players render a locally-predicted car: the client runs
the same planck.js sim with your unacked inputs plus your partner's last-known
input, reconciling smoothly against every authoritative snapshot. Spectators
render interpolated snapshots.

**Robustness** — if a driver drops, their seat is reserved for 30 s and reclaimed
automatically on reconnect (the client retries with a session token). Extra
joiners beyond the two seats become spectators (up to 8). The interpolation
delay adapts to measured network jitter.

## Commands

| Command | What |
|---|---|
| `npm test` | Run all unit + integration tests (Vitest) |
| `npm run typecheck` | Strict TypeScript across all packages |
| `npm run dev:server` / `dev:client` | Development servers |
| `npm run build -w @tandem/client` | Production client bundle |

## Repository layout

```
packages/
├── shared/   # protocol, physics sim (planck.js), WorldMap road-spline format + generators
├── server/   # authoritative Node server: rooms, seats, 60 Hz sim, 20 Hz snapshots (ws)
└── client/   # Vite + React Three Fiber: 3D scene, chase camera, prediction, interpolation
```

## Configuration

- `PORT` — server listen port (default `8080`).
- `VITE_SERVER_URL` — WebSocket URL the client connects to (default `ws://localhost:8080`).
- `GET /healthz` on the server reports liveness, room/player counts, and uptime.

## Deployment

- **Server:** `docker build -t tandem-drift .` — a hardened Node 22 Alpine image
  running the authoritative server on `PORT` (default 8080) with a health check.
- **Client:** `npm run build -w @tandem/client` and serve `packages/client/dist`
  from any static host, with `VITE_SERVER_URL` pointing at the server (wss:// in
  production).
- **CI:** GitHub Actions runs typecheck, all tests, and the client build on
  every push and pull request.
