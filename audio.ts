// Chiptune-Synth via WebAudio API (echt 8-Bit, keine Assets nötig).
// - Musik: rollierendes Square-Wave-Arpeggio in Dur.
// - SFX:   Sprung, Coin, Treffer, Levelende.

export class Chiptune {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmTimer: number | null = null;
  private step = 0;
  muted = false;

  init() {
    if (this.ctx) return;
    const AC = (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.15;
    this.master.connect(this.ctx.destination);
  }

  private tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.4) {
    if (!this.ctx || !this.master || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0;
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur + 0.02);
  }

  jump()  { this.tone(660, 0.08); this.tone(880, 0.08); }
  coin()  { this.tone(1320, 0.06, "square", 0.35); setTimeout(() => this.tone(1760, 0.08, "square", 0.3), 40); }
  hit()   { this.tone(220, 0.18, "sawtooth", 0.5); this.tone(120, 0.24, "sawtooth", 0.4); }
  win()   { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.14), i * 90)); }
  gameOver() { [392, 349, 311, 261].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, "square", 0.4), i * 140)); }

  startBgm() {
    this.init();
    if (this.bgmTimer !== null) return;
    // Simple cheery arpeggio in C major
    const notes = [261.6, 329.6, 392.0, 523.2, 392.0, 329.6];
    this.bgmTimer = window.setInterval(() => {
      if (this.muted) return;
      const f = notes[this.step % notes.length];
      this.tone(f, 0.12, "triangle", 0.18);
      if (this.step % 6 === 0) this.tone(f / 2, 0.20, "square", 0.10);
      this.step++;
    }, 200);
  }

  stopBgm() {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}
