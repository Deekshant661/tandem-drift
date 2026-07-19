/**
 * Synthesized engine hum via Web Audio — a sawtooth whose pitch and volume
 * track vehicle speed. No audio assets required. Browsers block audio until a
 * user gesture, so start() is called lazily from the first keydown.
 */
export class EngineAudio {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  start(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.osc = this.ctx.createOscillator();
    this.gain = this.ctx.createGain();
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = 60;
    this.gain.gain.value = 0;
    this.osc.connect(this.gain).connect(this.ctx.destination);
    this.osc.start();
  }

  /** speed in m/s; ~30 m/s is flat out. */
  update(speed: number): void {
    if (!this.ctx || !this.osc || !this.gain) return;
    const t = this.ctx.currentTime;
    const norm = Math.min(1, speed / 30);
    this.osc.frequency.setTargetAtTime(60 + norm * 180, t, 0.1);
    this.gain.gain.setTargetAtTime(norm * 0.08, t, 0.1);
  }
}
