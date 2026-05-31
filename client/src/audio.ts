import Phaser from "phaser";

export type SfxKey = "jump" | "land" | "join";

const MUTE_STORAGE_KEY = "jumper.audio.muted";
const DEFAULT_VOLUME = 0.4;

interface ToneSpec {
  startFreq: number;
  endFreq: number;
  durationMs: number;
  type: "sine" | "triangle" | "square";
  attackMs?: number;
  releaseMs?: number;
  gain?: number;
}

const SFX_SPECS: Record<SfxKey, ToneSpec> = {
  // Soft upward chirp
  jump: { startFreq: 420, endFreq: 720, durationMs: 140, type: "triangle", attackMs: 4, releaseMs: 100, gain: 0.55 },
  // Low thump
  land: { startFreq: 220, endFreq: 110, durationMs: 160, type: "sine", attackMs: 2, releaseMs: 130, gain: 0.65 },
  // Cozy double-click ding
  join: { startFreq: 660, endFreq: 880, durationMs: 180, type: "sine", attackMs: 6, releaseMs: 140, gain: 0.45 },
};

/**
 * Synthesize a short WAV (16-bit PCM mono) from a tone spec and add it to the
 * Phaser audio cache so `sound.play(key)` works through SoundManager.
 */
function synthesizeWavBlob(spec: ToneSpec, sampleRate = 44100): Blob {
  const totalSamples = Math.floor((spec.durationMs / 1000) * sampleRate);
  const attackSamples = Math.floor(((spec.attackMs ?? 5) / 1000) * sampleRate);
  const releaseSamples = Math.floor(((spec.releaseMs ?? 80) / 1000) * sampleRate);
  const sustainSamples = Math.max(0, totalSamples - attackSamples - releaseSamples);

  const samples = new Float32Array(totalSamples);
  let phase = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / totalSamples;
    const freq = spec.startFreq + (spec.endFreq - spec.startFreq) * t;
    phase += (2 * Math.PI * freq) / sampleRate;
    let v: number;
    switch (spec.type) {
      case "square":   v = Math.sign(Math.sin(phase)); break;
      case "triangle": v = (2 / Math.PI) * Math.asin(Math.sin(phase)); break;
      default:         v = Math.sin(phase);
    }
    let env: number;
    if (i < attackSamples) env = i / Math.max(1, attackSamples);
    else if (i < attackSamples + sustainSamples) env = 1;
    else env = Math.max(0, 1 - (i - attackSamples - sustainSamples) / Math.max(1, releaseSamples));
    samples[i] = v * env * (spec.gain ?? 0.5);
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export class AudioBus {
  private muted = false;
  private ready = false;

  constructor(private scene: Phaser.Scene) {}

  /** Queue synthesized SFX into the scene loader. Call from preload(). */
  preload(): void {
    for (const key of Object.keys(SFX_SPECS) as SfxKey[]) {
      const url = URL.createObjectURL(synthesizeWavBlob(SFX_SPECS[key]));
      this.scene.load.audio(key, url);
    }
  }

  /** Wire up volume, persisted mute, and M-key toggle. Call from create(). */
  init(): void {
    this.scene.sound.volume = DEFAULT_VOLUME;
    this.muted = this.readMutePref();
    this.scene.sound.mute = this.muted;

    const kbd = this.scene.input.keyboard;
    if (kbd) {
      const mKey = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.M);
      mKey.on("down", () => this.toggleMute());
    }
    this.ready = true;
  }

  play(key: SfxKey, opts: { volume?: number } = {}): void {
    if (!this.ready || this.muted) return;
    const sound = this.scene.sound;
    if (!sound.get(key) && !this.scene.cache.audio.exists(key)) return;
    sound.play(key, { volume: opts.volume ?? 1 });
  }

  isMuted(): boolean { return this.muted; }

  toggleMute(): void {
    this.muted = !this.muted;
    this.scene.sound.mute = this.muted;
    try { localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? "1" : "0"); } catch { /* ignore */ }
    this.scene.events.emit("audio:mute-changed", this.muted);
  }

  private readMutePref(): boolean {
    try { return localStorage.getItem(MUTE_STORAGE_KEY) === "1"; } catch { return false; }
  }
}
