/**
 * All game audio, synthesized with Web Audio — no asset downloads. Browsers
 * block audio until a user gesture, so start() is called lazily on first
 * keydown. Each sound is a small synth patch; replacing any of them with
 * recorded assets later only touches this module.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private skidGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  start(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;

    // Engine hum: sawtooth, pitch/volume track speed.
    this.engineOsc = ctx.createOscillator();
    this.engineGain = ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineGain).connect(ctx.destination);
    this.engineOsc.start();

    // Shared noise buffer for skid/collision.
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    // Continuous skid loop: band-passed noise, gated by skid().
    const skidSrc = ctx.createBufferSource();
    skidSrc.buffer = buf;
    skidSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    skidSrc.connect(bp).connect(this.skidGain).connect(ctx.destination);
    skidSrc.start();
  }

  /** Per-tick update: engine follows speed; skid follows drift state. */
  update(speedMs: number, skidding: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.skidGain) return;
    const t = this.ctx.currentTime;
    const norm = Math.min(1, speedMs / 30);
    this.engineOsc.frequency.setTargetAtTime(60 + norm * 180, t, 0.1);
    this.engineGain.gain.setTargetAtTime(norm * 0.08, t, 0.1);
    this.skidGain.gain.setTargetAtTime(skidding && speedMs > 4 ? 0.12 : 0, t, 0.05);
  }

  /** Collision thump: short low noise burst scaled by impulse 0..1. */
  collision(impulse: number): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.5, impulse * 0.5), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    src.connect(lp).connect(g).connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + 0.3);
  }

  /** Friendly two-tone horn while the key is held (fixed 300 ms beep). */
  horn(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (const freq of [440, 554]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.setTargetAtTime(0, ctx.currentTime + 0.25, 0.03);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.4);
    }
  }

  /** UI click blip. */
  click(): void {
    if (!this.ctx) this.start();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 880;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.1);
  }
}
