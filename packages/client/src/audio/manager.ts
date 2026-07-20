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
  private ambient: Record<'village' | 'forest' | 'lake' | 'fields', GainNode> | null = null;
  private windGain: GainNode | null = null;
  private tireGain: GainNode | null = null;

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

    this.ambient = this.makeAmbientLayer(ctx, buf, master);

    // Wind rush and tire roll — the two layers that should take over from
    // the engine as speed rises, so top speed sounds like genuine motion
    // through air, not just a louder motor. Both react to update()/speedMs.
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'highpass';
    windFilter.frequency.value = 1100;
    windFilter.Q.value = 0.3;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(windFilter).connect(this.windGain).connect(master);
    windSrc.start();

    const tireSrc = ctx.createBufferSource();
    tireSrc.buffer = buf;
    tireSrc.loop = true;
    const tireFilter = ctx.createBiquadFilter();
    tireFilter.type = 'bandpass';
    tireFilter.frequency.value = 450;
    tireFilter.Q.value = 0.7;
    this.tireGain = ctx.createGain();
    this.tireGain.gain.value = 0;
    tireSrc.connect(tireFilter).connect(this.tireGain).connect(master);
    tireSrc.start();
  }

  /**
   * Four soft, continuous area loops (village/forest/lake/fields) — never
   * music, never loud — individually gain-crossfaded by updateAmbient()
   * using the same continuous position blend as the visual atmosphere.
   * No new synthesis idea here, just more filtered-noise loops layered at
   * very low gain, exactly like the existing skid loop.
   */
  private makeAmbientLayer(
    ctx: AudioContext,
    noise: AudioBuffer,
    master: AudioNode,
  ): Record<'village' | 'forest' | 'lake' | 'fields', GainNode> {
    const makeLoop = (filterType: BiquadFilterType, freq: number, q: number): GainNode => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(master);
      src.start();
      return gain;
    };
    return {
      village: makeLoop('bandpass', 1400, 0.6), // soft wind + distant birds register
      forest: makeLoop('bandpass', 2600, 0.9), // higher, chirpier insect/bird register
      lake: makeLoop('lowpass', 500, 0.5), // soft water/wind register
      fields: makeLoop('bandpass', 800, 0.4), // low open-wind register
    };
  }

  /** Crossfade the four ambient loops by each area's current influence
   *  (0..1, same blend the visual atmosphere uses) — subtle, never loud. */
  updateAmbient(weights: { village: number; forest: number; lake: number; fields: number }): void {
    if (!this.ctx || !this.ambient) return;
    const t = this.ctx.currentTime;
    this.ambient.village.gain.setTargetAtTime(weights.village * 0.05, t, 0.6);
    this.ambient.forest.gain.setTargetAtTime(weights.forest * 0.045, t, 0.6);
    this.ambient.lake.gain.setTargetAtTime(weights.lake * 0.06, t, 0.6);
    this.ambient.fields.gain.setTargetAtTime(weights.fields * 0.045, t, 0.6);
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

  /**
   * Per-tick update. Three engine bands crossfade by speed, but their
   * combined presence is deliberately dialed BACK as speed rises (via
   * `engineFade`) while wind and tire-roll noise grow — the goal, per
   * direction feedback, is the opposite of "the engine gets louder and
   * shriller with speed": at the top of the speed range, rushing air and
   * road noise should be what you actually notice, with the engine
   * receding into the background exactly like a real car.
   */
  update(speedMs: number, skidding: boolean): void {
    if (!this.ctx || this.bands.length === 0 || !this.skidGain) return;
    const t = this.ctx.currentTime;
    // 37 m/s (~132 km/h) is the car's actual measured terminal velocity
    // under the shared sim's aerodynamic drag — norm now reaches 1 only at
    // genuine top speed, instead of pinning "flat out" a third of the way
    // there (the old 30 m/s ceiling, back when top speed was unbounded).
    const norm = Math.min(1, speedMs / 37);
    const smoothing = 0.12;

    // Engine presence fades from 100% at a standstill to 55% at top speed —
    // still audible, but no longer the dominant sound.
    const engineFade = 1 - norm * 0.45;
    for (const band of this.bands) {
      const weight = bandWeight(norm, band.center, band.width);
      band.gain.gain.setTargetAtTime(band.peakGain * weight * engineFade, t, smoothing);
      const freq = band.baseFreq + norm * band.freqRange;
      band.osc.frequency.setTargetAtTime(freq, t, smoothing);
    }

    // Wind builds up faster than linearly — barely there at low speed,
    // clearly the loudest layer by top speed.
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(norm * norm * 0.22, t, smoothing);
    }
    // Tire roll: present at moderate-to-high speed, quiet at a crawl.
    if (this.tireGain) {
      this.tireGain.gain.setTargetAtTime(Math.max(0, norm - 0.15) * 0.07, t, smoothing);
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
