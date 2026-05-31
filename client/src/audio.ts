import Phaser from "phaser";

export type SfxKey = "jump" | "land" | "join";

const SFX_KEYS: SfxKey[] = ["jump", "land", "join"];
const MUTE_STORAGE_KEY = "jumper.audio.muted";
const DEFAULT_VOLUME = 0.4;

export class AudioBus {
  private muted = false;
  private ready = false;

  constructor(private scene: Phaser.Scene) {}

  preload(): void {
    for (const key of SFX_KEYS) {
      this.scene.load.audio(key, "/assets/sfx/" + key + ".wav");
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
