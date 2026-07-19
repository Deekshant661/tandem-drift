# Manual smoke checklist (3D client)

Run before releases. Two browser tabs, dev or production.

1. **Lobby** — name + map select render; Create makes a room (click sound);
   Join with the 6-char code seats tab 2 as engineer.
2. **World** — Willowbrook renders: road with white edges, village houses,
   forest, lake + bridge, spinning windmills, tunnel arch, clouds drifting,
   mountains + fog on the horizon.
3. **Driving** — engineer W accelerates, S brakes (brake lights glow),
   reverse shows R in the gear slot + white reverse light; pilot A/D steers
   (front wheels visibly steer, body rolls, riders lean, pilot head turns).
4. **Drift** — Space at speed: skid sound, tire smoke, rubber marks fading.
5. **Collision** — hit a wall: camera shake, sparks, thump sound, rider jolt.
6. **Race** — green gate ring floats at next checkpoint; lap/best times tick
   in the room card; minimap dot follows the car.
7. **Camera** — chase cam smooth at speed, FOV widens; hold C looks back.
8. **Seat swap** — Tab on both tabs swaps roles and control ownership.
9. **Pause** — Esc opens menu; Resume returns; Leave Room reloads to lobby.
10. **Reconnect** — kill the server 5 s, restart: client auto-reconnects and
    reclaims the same seat.
11. **Spectator** — third tab joins as spectator, sees the car drive.
12. **Horn** — H honks. Obviously the most important test.
