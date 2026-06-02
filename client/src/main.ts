import Phaser from "phaser";
import { Client, Room, getStateCallbacks } from "colyseus.js";
import type { JumperRoomState, PlayerState } from "@jumper/shared";

// In dev, Vite proxies Colyseus traffic from the page port to the game server.
// In production, serve client and server from the same origin.
const SERVER_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

// Isometric projection
const TILE_W = 64;
const TILE_H = 32;
const WORLD_SIZE = 50;
const NAME_STORAGE_KEY = "jumper.name";
const MAX_NAME_LEN = 16;

function sanitizeClientName(raw: string): string {
  return raw.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, MAX_NAME_LEN);
}

function loadStoredName(): string {
  try {
    const v = window.localStorage.getItem(NAME_STORAGE_KEY);
    return v ? sanitizeClientName(v) : "";
  } catch {
    return "";
  }
}

function saveStoredName(name: string): void {
  try { window.localStorage.setItem(NAME_STORAGE_KEY, name); } catch { /* ignore quota/disabled */ }
}

function promptForName(initial: string): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.getElementById("name-overlay") as HTMLDivElement | null;
    const form = document.getElementById("name-form") as HTMLFormElement | null;
    const input = document.getElementById("name-input") as HTMLInputElement | null;
    if (!overlay || !form || !input) { resolve(initial); return; }
    input.value = initial;
    overlay.hidden = false;
    input.focus();
    input.select();
    const onSubmit = (e: Event) => {
      e.preventDefault();
      const name = sanitizeClientName(input.value);
      if (name.length === 0) { input.focus(); return; }
      overlay.hidden = true;
      form.removeEventListener("submit", onSubmit);
      resolve(name);
    };
    form.addEventListener("submit", onSubmit);
  });
}

function isoToScreen(tx: number, ty: number, tz = 0): { x: number; y: number } {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2) - tz * 22,
  };
}

interface PlayerView {
  shadow: Phaser.GameObjects.Ellipse;
  body: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean };

class GameScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private playerCountText!: Phaser.GameObjects.Text;
  private room?: Room<JumperRoomState>;
  private playerViews = new Map<string, PlayerView>();
  private keys!: {
    left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
  };
  private lastInput: Input = { left: false, right: false, up: false, down: false, jump: false };
  private originX = 480;
  private originY = 160;

  constructor() {
    super("Game");
  }

  create(): void {
    this.drawBackground();
    this.drawTiles();

    this.statusText = this.add.text(8, 8, "Connecting...", {
      fontFamily: "monospace", fontSize: "13px", color: "#ffffff",
    }).setScrollFactor(0).setDepth(100);

    this.playerCountText = this.add.text(8, 28, "", {
      fontFamily: "monospace", fontSize: "13px", color: "#aaffaa",
    }).setScrollFactor(0).setDepth(100);

    this.add.text(8, this.scale.height - 20, "WASD/Arrows: move  |  Space: jump", {
      fontFamily: "monospace", fontSize: "11px", color: "#888888",
    }).setScrollFactor(0).setDepth(100);

    const kbd = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left:  kbd.addKey(K.LEFT),  right: kbd.addKey(K.RIGHT),
      up:    kbd.addKey(K.UP),    down:  kbd.addKey(K.DOWN),
      w:     kbd.addKey(K.W),     a:     kbd.addKey(K.A),
      s:     kbd.addKey(K.S),     d:     kbd.addKey(K.D),
      space: kbd.addKey(K.SPACE),
    };

    void this.connect();
  }

  private drawBackground(): void {
    const w = this.scale.width, h = this.scale.height;
    const g = this.add.graphics().setScrollFactor(0).setDepth(-10);
    g.fillGradientStyle(0x87ceeb, 0x87ceeb, 0xd4e8c2, 0xd4e8c2, 1);
    g.fillRect(0, 0, w, h);
  }

  private drawTiles(): void {
    const g = this.add.graphics().setDepth(0);
    for (let ty = 0; ty < WORLD_SIZE; ty++) {
      for (let tx = 0; tx < WORLD_SIZE; tx++) {
        const { x, y } = isoToScreen(tx, ty);
        const sx = x + this.originX;
        const sy = y + this.originY;
        const color = (tx + ty) % 2 === 0 ? 0x5b8c3e : 0x3d6b2e;
        const hw = TILE_W / 2, hh = TILE_H / 2;
        g.fillStyle(color, 1);
        g.fillPoints([
          { x: sx,      y: sy - hh },
          { x: sx + hw, y: sy },
          { x: sx,      y: sy + hh },
          { x: sx - hw, y: sy },
        ], true);
        g.lineStyle(1, 0x000000, 0.12);
        g.strokePoints([
          { x: sx,      y: sy - hh },
          { x: sx + hw, y: sy },
          { x: sx,      y: sy + hh },
          { x: sx - hw, y: sy },
        ], true);
      }
    }
  }

  private screenPos(tx: number, ty: number, tz = 0): { x: number; y: number } {
    const iso = isoToScreen(tx, ty, tz);
    return { x: iso.x + this.originX, y: iso.y + this.originY };
  }

  private client = new Client(SERVER_URL);
  private reconnectionToken?: string;
  private playerName = "";

  private async connect(): Promise<void> {
    try {
      let name = loadStoredName();
      if (!name) name = await promptForName("");
      saveStoredName(name);
      this.playerName = name;
      this.showEditNameButton();
      const room = await this.client.joinOrCreate<JumperRoomState>("jumper", { name });
      this.attachRoom(room);
    } catch (err) {
      console.error("[client] connect failed", err);
      this.statusText.setText(`Connect failed: ${(err as Error).message}`);
    }
  }

  private showEditNameButton(): void {
    const btn = document.getElementById("name-edit") as HTMLButtonElement | null;
    if (!btn) return;
    btn.hidden = false;
    btn.textContent = `name: ${this.playerName}`;
    btn.onclick = async () => {
      const next = await promptForName(this.playerName);
      saveStoredName(next);
      this.playerName = next;
      btn.textContent = `name: ${next}`;
      // Rejoining the server isn't required for the persistence story (F3 just needs
      // the saved name to be sent on the next join), but tell the user to refresh
      // for the rename to apply to other players this session.
      this.statusText.setText(`Name saved — refresh to apply: ${next}`);
    };
  }

  private attachRoom(room: Room<JumperRoomState>): void {
    this.room = room;
    this.reconnectionToken = room.reconnectionToken;
    this.statusText.setText(`Room: ${room.roomId}`);
    console.log("[client] joined", room.roomId, room.sessionId);

    const $ = getStateCallbacks(room);
    $(room.state).players.onAdd((player: PlayerState, sessionId: string) => {
      this.addPlayerView(sessionId, player, $);
      this.updateCount();
    });
    $(room.state).players.onRemove((_p: PlayerState, sessionId: string) => {
      this.removePlayerView(sessionId);
      this.updateCount();
    });

    room.onLeave((code) => {
      // Codes 1000/1001 are consented closure — don't try to reconnect.
      const consented = code === 1000 || code === 1001;
      if (consented || !this.reconnectionToken) {
        this.statusText.setText("Disconnected — refresh to rejoin");
        for (const id of [...this.playerViews.keys()]) this.removePlayerView(id);
        this.playerCountText.setText("Players: 0");
        return;
      }
      this.statusText.setText("Disconnected — reconnecting…");
      void this.attemptReconnect();
    });
  }

  private async attemptReconnect(): Promise<void> {
    const token = this.reconnectionToken;
    if (!token) return;
    const deadline = Date.now() + 30_000;
    let attempt = 0;
    while (Date.now() < deadline) {
      attempt++;
      try {
        const room = await this.client.reconnect<JumperRoomState>(token);
        console.log("[client] reconnected", room.roomId, room.sessionId);
        this.statusText.setText(`Room: ${room.roomId} (reconnected)`);
        // Clear stale views — onAdd will repopulate from the rejoined state.
        for (const id of [...this.playerViews.keys()]) this.removePlayerView(id);
        this.attachRoom(room);
        return;
      } catch (err) {
        console.warn(`[client] reconnect attempt ${attempt} failed`, err);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    this.statusText.setText("Reconnect failed — refresh to rejoin");
    for (const id of [...this.playerViews.keys()]) this.removePlayerView(id);
    this.playerCountText.setText("Players: 0");
  }

  private addPlayerView(
    sessionId: string,
    player: PlayerState,
    $: ReturnType<typeof getStateCallbacks<JumperRoomState>>,
  ): void {
    const isSelf = this.room?.sessionId === sessionId;
    const pos = this.screenPos(player.x, player.y, player.z);
    const groundPos = this.screenPos(player.x, player.y, 0);

    const baseDepth = (player.x + player.y) * 10;
    const shadow = this.add.ellipse(groundPos.x, groundPos.y + 4, 28, 10, 0x000000, 0.35).setDepth(baseDepth);
    const body = this.add.circle(pos.x, pos.y, 14, player.color).setDepth(baseDepth + 1);
    body.setStrokeStyle(isSelf ? 3 : 1, isSelf ? 0xffffff : 0x333333);
    const label = this.add.text(pos.x, pos.y - 22, player.name || sessionId.slice(0, 4), {
      fontFamily: "monospace", fontSize: "11px", color: "#ffffff",
      backgroundColor: "#00000066", padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 1).setDepth(baseDepth + 2);

    this.playerViews.set(sessionId, { shadow, body, label });

    $(player).onChange(() => {
      const view = this.playerViews.get(sessionId);
      if (!view) return;
      const p = this.screenPos(player.x, player.y, player.z);
      const gp = this.screenPos(player.x, player.y, 0);
      view.shadow.setPosition(gp.x, gp.y + 4);
      const shadowScale = Math.max(0.4, 1 - player.z * 0.018);
      view.shadow.setScale(shadowScale);
      view.body.setPosition(p.x, p.y);
      view.body.setFillStyle(player.color);
      const stretchY = player.isJumping ? (player.velZ > 0 ? 1.3 : 0.85) : 1;
      view.body.setScale(1 / stretchY, stretchY);
      view.label.setPosition(p.x, p.y - 22);
      // Jumping players sort above ground-level players at same (x,y)
      const depth = (player.x + player.y) * 10 + player.z * 0.1;
      view.shadow.setDepth(depth);
      view.body.setDepth(depth + 1);
      view.label.setDepth(depth + 2);
    });
  }

  private removePlayerView(sessionId: string): void {
    const view = this.playerViews.get(sessionId);
    if (!view) return;
    view.shadow.destroy();
    view.body.destroy();
    view.label.destroy();
    this.playerViews.delete(sessionId);
  }

  private updateCount(): void {
    const n = this.room?.state.players.size ?? 0;
    this.playerCountText.setText(`${n}/? players`);
  }

  override update(): void {
    if (!this.room) return;
    const input: Input = {
      left:  this.keys.left.isDown  || this.keys.a.isDown,
      right: this.keys.right.isDown || this.keys.d.isDown,
      up:    this.keys.up.isDown    || this.keys.w.isDown,
      down:  this.keys.down.isDown  || this.keys.s.isDown,
      jump:  Phaser.Input.Keyboard.JustDown(this.keys.space),
    };
    const changed = (Object.keys(input) as (keyof Input)[]).some(k => input[k] !== this.lastInput[k]);
    if (changed) {
      this.room.send("input", input);
      this.lastInput = { ...input };
    }
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 640,
  backgroundColor: "#87ceeb",
  scene: [GameScene],
};

new Phaser.Game(config);
