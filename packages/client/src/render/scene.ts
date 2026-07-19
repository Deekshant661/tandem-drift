import { Application, Container, Graphics } from 'pixi.js';
import { ARENA_HEIGHT, ARENA_WIDTH, type TrackMap, type VehicleSnapshot } from '@tandem/shared';

/** Pixels per simulation meter. */
const SCALE = 10;

/**
 * PixiJS scene: walled arena with a camera that follows the car.
 * World coordinates are meters, +y up; Pixi's y axis points down, so the
 * world container is y-flipped once here and nowhere else.
 */
export class Scene {
  readonly app = new Application();
  private readonly world = new Container();
  private readonly car = new Container();
  private map: TrackMap | null = null;
  private readonly gates: Graphics[] = [];
  private activeGate = -1;

  async init(map: TrackMap): Promise<void> {
    this.map = map;
    await this.app.init({
      resizeTo: window,
      background: 0x10141c,
      antialias: true,
    });
    document.body.appendChild(this.app.canvas);

    this.world.scale.set(SCALE, -SCALE);
    this.app.stage.addChild(this.world);

    // Tarmac base with a subtle grid for motion readability.
    const ground = new Graphics()
      .rect(-ARENA_WIDTH / 2, -ARENA_HEIGHT / 2, ARENA_WIDTH, ARENA_HEIGHT)
      .fill(0x1a2230);
    for (let x = -ARENA_WIDTH / 2 + 10; x < ARENA_WIDTH / 2; x += 10) {
      ground.moveTo(x, -ARENA_HEIGHT / 2).lineTo(x, ARENA_HEIGHT / 2);
    }
    for (let y = -ARENA_HEIGHT / 2 + 10; y < ARENA_HEIGHT / 2; y += 10) {
      ground.moveTo(-ARENA_WIDTH / 2, y).lineTo(ARENA_WIDTH / 2, y);
    }
    ground.stroke({ width: 0.08, color: 0x263145 });
    this.world.addChild(ground);

    // Track walls, exactly as the server simulates them.
    const walls = new Graphics();
    for (const seg of map.walls) {
      walls.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2);
    }
    walls.stroke({ width: 0.6, color: 0x3b4a63 });
    this.world.addChild(walls);

    // Checkpoint gates; index 0 (start/finish) drawn distinctly.
    map.checkpoints.forEach((cp, i) => {
      const gate = new Graphics()
        .circle(cp.x, cp.y, cp.radius)
        .stroke({ width: 0.3, color: i === 0 ? 0xfbbf24 : 0x334761, alpha: 0.9 });
      this.gates.push(gate);
      this.world.addChild(gate);
    });

    const body = new Graphics()
      .roundRect(-0.9, -2.0, 1.8, 4.0, 0.45)
      .fill(0xef4444)
      .stroke({ width: 0.12, color: 0x7f1d1d });
    const windshield = new Graphics().roundRect(-0.65, 0.35, 1.3, 1.0, 0.2).fill(0x93c5fd);
    this.car.addChild(body, windshield);
    this.world.addChild(this.car);
  }

  /** Highlight the gate the crew must reach next. No-op until init completes. */
  setActiveGate(index: number): void {
    if (!this.map || this.gates.length === 0 || index === this.activeGate) return;
    this.activeGate = index;
    const checkpoints = this.map.checkpoints;
    this.gates.forEach((gate, i) => {
      const cp = checkpoints[i]!;
      gate
        .clear()
        .circle(cp.x, cp.y, cp.radius)
        .stroke({
          width: i === index ? 0.6 : 0.3,
          color: i === index ? 0x34d399 : i === 0 ? 0xfbbf24 : 0x334761,
          alpha: 0.9,
        });
    });
  }

  /** Place the car and center the camera on it. */
  update(v: VehicleSnapshot): void {
    this.car.position.set(v.x, v.y);
    this.car.rotation = -v.angle; // y-flip inverts rotation direction
    this.world.position.set(
      this.app.screen.width / 2 - v.x * SCALE,
      this.app.screen.height / 2 + v.y * SCALE,
    );
  }
}
