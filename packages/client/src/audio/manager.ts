import { bandWeight, ENGINE_BANDS } from './engineCurve.js';

/**
 * All game audio, synthesized with Web Audio — no asset downloads. Browsers
 * block audio until a user gesture, so start() is called lazily on first
 * keydown. Each sound is a small synth patch; replacing any of them with
 * recorded assets later only touches this module.
 */

interface EngineBand {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  baseFreq: number;
  freqRange: number;
  center: number;
  width: number;
  peakGain: number;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: DynamicsCompressorNode | null = null;
  private bands: EngineBand[] = [];
  private skidGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  start(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;

    // Every sound routes through one master compressor — a safety net so
    // overlapping layers (engine bands + skid + collision + horn) can never
    // sum into clipping or harshness, however they combine.
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -18;
    master.knee.value = 12;
    master.ratio.value = 4;
    master.attack.value = 0.003;
    master.release.value = 0.15;
    master.connect(ctx.destination);
    this.master = master;

    // Three overlapping engine "gears" — idle, low, high — each a filtered
    // sawtooth with its own narrow pitch range, crossfaded by speed. This
    // avoids one oscillator sweeping continuously upward, which is what
    // made the old engine sound shriller and buzzier at speed. The high
    // band stays deliberately mellow (low filter cutoff, modest pitch range)
    // so top speed sounds throaty and exciting rather than harsh.
    this.bands = [
      this.makeBand(ctx, { baseFreq: 55, freqRange: 10, ...ENGINE_BANDS.idle, peakGain: 0.07, filterHz: 480 }),
      this.makeBand(ctx, { baseFreq: 95, freqRange: 32, ...ENGINE_BANDS.low, peakGain: 0.06, filterHz: 680 }),
      this.makeBand(ctx, { baseFreq: 145, freqRange: 38, ...ENGINE_BANDS.high, peakGain: 0.05, filterHz: 880 }),
    ];

    // Shared noise buffer for skid/collision.
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    // Continuous skid loop: band-passed noise, gated by update().
    const skidSrc = ctx.createBufferSource();
    skidSrc.buffer = buf;
    skidSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    skidSrc.connect(bp).connect(this.skidGain).connect(master);
    skidSrc.start();
  }

  private makeBand(
    ctx: AudioContext,
    opts: {
      baseFreq: number;
      freqRange: number;
      center: number;
      width: number;
      peakGain: number;
      filterHz: number;
    },
  ): EngineBand {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = opts.baseFreq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // A gentle lowpass tames the sawtooth's upper harmonics so the engine
    // stays warm and rounded rather than harsh, even in the "high" band.
    filter.frequency.value = opts.filterHz;
    filter.Q.value = 0.4;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(this.master!);
    osc.start();
    return {
      osc,
      filter,
      gain,
      baseFreq: opts.baseFreq,
      freqRange: opts.freqRange,
      center: opts.center,
      width: opts.width,
      peakGain: opts.peakGain,
    };
  }

  /** Per-tick update: three engine bands crossfade by speed with limited,
   *  independent pitch ranges; the skid loop gates on drift state. */
  update(speedMs: number, skidding: boolean): void {
    if (!this.ctx || this.bands.length === 0 || !this.skidGain) return;
    const t = this.ctx.currentTime;
    const norm = Math.min(1, speedMs / 30);
    const smoothing = 0.12;

    for (const band of this.bands) {
      const weight = bandWeight(norm, band.center, band.width);
      band.gain.gain.setTargetAtTime(band.peakGain * weight, t, smoothing);
      const freq = band.baseFreq + norm * band.freqRange;
      band.osc.frequency.setTargetAtTime(freq, t, smoothing);
    }

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
    src.connect(lp).connect(g).connect(this.master!);
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
      o.connect(g).connect(this.master!);
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
    o.connect(g).connect(this.master!);
    o.start();
    o.stop(ctx.currentTime + 0.1);
  }
}
