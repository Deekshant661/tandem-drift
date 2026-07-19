import { Application, Container, Graphics } from 'pixi.js';
import { ARENA_HEIGHT, ARENA_WIDTH, type VehicleSnapshot } from '@tandem/shared';

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

  async init(): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: 0x10141c,
      antialias: true,
    });
    document.body.appendChild(this.app.canvas);

    this.world.scale.set(SCALE, -SCALE);
    this.app.stage.addChild(this.world);

    const arena = new Graphics()
      .rect(-ARENA_WIDTH / 2, -ARENA_HEIGHT / 2, ARENA_WIDTH, ARENA_HEIGHT)
      .fill(0x1a2230)
      .stroke({ width: 0.6, color: 0x3b4a63 });
    // Center-line grid to make motion readable.
    for (let x = -ARENA_WIDTH / 2 + 10; x < ARENA_WIDTH / 2; x += 10) {
      arena.moveTo(x, -ARENA_HEIGHT / 2).lineTo(x, ARENA_HEIGHT / 2);
    }
    for (let y = -ARENA_HEIGHT / 2 + 10; y < ARENA_HEIGHT / 2; y += 10) {
      arena.moveTo(-ARENA_WIDTH / 2, y).lineTo(ARENA_WIDTH / 2, y);
    }
    arena.stroke({ width: 0.08, color: 0x263145 });
    this.world.addChild(arena);

    const body = new Graphics()
      .roundRect(-0.9, -2.0, 1.8, 4.0, 0.45)
      .fill(0xef4444)
      .stroke({ width: 0.12, color: 0x7f1d1d });
    const windshield = new Graphics().roundRect(-0.65, 0.35, 1.3, 1.0, 0.2).fill(0x93c5fd);
    this.car.addChild(body, windshield);
    this.world.addChild(this.car);
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
