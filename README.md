# Tandem Drift

A browser-based cooperative multiplayer game where **two players drive one car**:
the **pilot** steers, the **engineer** works the throttle, brake, and handbrake.
Physics-based, server-authoritative, chaos guaranteed.

See [plan.md](plan.md) for the full architecture, tradeoffs, and milestone roadmap.

## Quick start

```bash
npm install
npm run dev:server    # authoritative game server on :8080
npm run dev:client    # Vite dev server on :5173 (separate terminal)
```

Open http://localhost:5173 — a room is created and its code appears in the HUD
(and in the URL). Open the same URL in a second tab/browser to take the second seat.

**Controls** — Pilot: `A`/`D` steer. Engineer: `W` throttle, `S` brake, `Space` handbrake.

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
├── shared/   # protocol, constants, and the vehicle physics sim (planck.js) — runs on both sides
├── server/   # authoritative Node server: rooms, seats, 60 Hz sim, 20 Hz snapshots (ws)
└── client/   # Vite + PixiJS: rendering, input, snapshot interpolation
```

## Configuration

- `PORT` — server listen port (default `8080`).
- `VITE_SERVER_URL` — WebSocket URL the client connects to (default `ws://localhost:8080`).
- `GET /healthz` on the server reports liveness and open room count.
