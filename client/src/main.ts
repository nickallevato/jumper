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
const CAMERA_EDGE_BUFFER = 48;

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

interface RosterView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  swatch: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  pulse?: Phaser.Tweens.Tween;
}

type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean };

class GameScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private playerCountText!: Phaser.GameObjects.Text;
  private room?: Room<JumperRoomState>;
  private playerViews = new Map<string, PlayerView>();
  private rosterViews = new Map<string, RosterView>();
  private rosterPanel!: Phaser.GameObjects.Graphics;
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
  private cameraTarget!: Phaser.Math.Vector2;
  private cameraFollow!: Phaser.GameObjects.Rectangle;
  private edgeIndicators!: Phaser.GameObjects.Graphics;

  constructor() {
    super("Game");
  }

  create(): void {
    this.drawBackground();
    this.drawTiles();
    this.setupCamera();

    this.edgeIndicators = this.add.graphics().setScrollFactor(0).setDepth(99);

    this.statusText = this.add.text(8, 8, "Connecting...", {
      fontFamily: "monospace", fontSize: "13px", color: "#ffffff",
    }).setScrollFactor(0).setDepth(100);

    this.playerCountText = this.add.text(8, 28, "", {
      fontFamily: "monospace", fontSize: "13px", color: "#aaffaa",
    }).setScrollFactor(0).setDepth(100);

    this.rosterPanel = this.add.graphics().setScrollFactor(0).setDepth(100);

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

  private setupCamera(): void {
    // Full iso diamond bounds plus viewport padding, so edge/corner players are
    // not clamped against the viewport edge when the camera follows them.
    const N = WORLD_SIZE;
    const viewportPadX = this.scale.width / 2 - CAMERA_EDGE_BUFFER;
    const viewportPadY = this.scale.height / 2 - CAMERA_EDGE_BUFFER;
    const minX = this.originX - (N - 1) * (TILE_W / 2) - (TILE_W / 2) - viewportPadX;
    const maxX = this.originX + (N - 1) * (TILE_W / 2) + (TILE_W / 2) + viewportPadX;
    const minY = this.originY - (TILE_H / 2) - viewportPadY;
    const maxY = this.originY + (2 * (N - 1)) * (TILE_H / 2) + (TILE_H / 2) + viewportPadY;
    this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);

    // Invisible follow target; we drive its position to the player centroid each frame.
    const center = this.screenPos((N - 1) / 2, (N - 1) / 2, 0);
    this.cameraTarget = new Phaser.Math.Vector2(center.x, center.y);
    this.cameraFollow = this.add.rectangle(center.x, center.y, 1, 1, 0x000000, 0).setVisible(false);
    // lerp 0.08 damps micro-movement without feeling sluggish.
    this.cameras.main.startFollow(this.cameraFollow, false, 0.08, 0.08);
    this.cameras.main.centerOn(center.x, center.y);
  }

  private updateCameraTarget(): void {
    if (!this.room || this.room.state.players.size === 0) return;
    let sx = 0, sy = 0, n = 0;
    this.room.state.players.forEach((p) => {
      const sp = this.screenPos(p.x, p.y, 0);
      sx += sp.x; sy += sp.y; n++;
    });
    this.cameraTarget.set(sx / n, sy / n);
    this.cameraFollow.setPosition(this.cameraTarget.x, this.cameraTarget.y);
  }

  private drawEdgeIndicators(): void {
    this.edgeIndicators.clear();
    if (!this.room) return;
    const cam = this.cameras.main;
    const selfId = this.room.sessionId;
    const w = cam.width, h = cam.height;
    const margin = 22;
    const cx = w / 2, cy = h / 2;

    this.room.state.players.forEach((p, sid) => {
      if (sid === selfId) return;
      const sp = this.screenPos(p.x, p.y, p.z);
      const relX = sp.x - cam.scrollX;
      const relY = sp.y - cam.scrollY;
      const onScreen = relX >= margin && relX <= w - margin && relY >= margin && relY <= h - margin;
      if (onScreen) return;

      const dx = relX - cx;
      const dy = relY - cy;
      const absX = Math.max(Math.abs(dx), 0.0001);
      const absY = Math.max(Math.abs(dy), 0.0001);
      const t = Math.min((cx - margin) / absX, (cy - margin) / absY);
      const ex = cx + dx * t;
      const ey = cy + dy * t;
      const ang = Math.atan2(dy, dx);

      const size = 12;
      const g = this.edgeIndicators;
      g.fillStyle(p.color, 1);
      g.lineStyle(2, 0x000000, 0.55);
      const tipX = ex + Math.cos(ang) * size;
      const tipY = ey + Math.sin(ang) * size;
      const leftX = ex + Math.cos(ang + 2.5) * size;
      const leftY = ey + Math.sin(ang + 2.5) * size;
      const rightX = ex + Math.cos(ang - 2.5) * size;
      const rightY = ey + Math.sin(ang - 2.5) * size;
      g.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
      g.strokeTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
    });
  }

  private screenPos(tx: number, ty: number, tz = 0): { x: number; y: number } {
    const iso = isoToScreen(tx, ty, tz);
    return { x: iso.x + this.originX, y: iso.y + this.originY };
  }

  private client = new Client(SERVER_URL);
  private reconnectionToken?: string;

  private async connect(): Promise<void> {
    try {
      const room = await this.client.joinOrCreate<JumperRoomState>("jumper");
      this.attachRoom(room);
    } catch (err) {
      console.error("[client] connect failed", err);
      this.statusText.setText(`Connect failed: ${(err as Error).message}`);
    }
  }

  private attachRoom(room: Room<JumperRoomState>): void {
    this.room = room;
    this.reconnectionToken = room.reconnectionToken;
    this.statusText.setText(`Room: ${room.roomId}`);
    console.log("[client] joined", room.roomId, room.sessionId);

    const $ = getStateCallbacks(room);
    $(room.state).players.onAdd((player: PlayerState, sessionId: string) => {
      this.addPlayerView(sessionId, player, $);
      this.addRosterView(sessionId, player, $);
      this.updateCount();
    });
    $(room.state).players.onRemove((_p: PlayerState, sessionId: string) => {
      this.removePlayerView(sessionId);
      this.removeRosterView(sessionId);
      this.updateCount();
    });

    room.onLeave((code) => {
      // Codes 1000/1001 are consented closure — don't try to reconnect.
      const consented = code === 1000 || code === 1001;
      if (consented || !this.reconnectionToken) {
        this.statusText.setText("Disconnected — refresh to rejoin");
        this.clearPlayerStateViews();
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
        this.clearPlayerStateViews();
        this.attachRoom(room);
        return;
      } catch (err) {
        console.warn(`[client] reconnect attempt ${attempt} failed`, err);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    this.statusText.setText("Reconnect failed — refresh to rejoin");
    this.clearPlayerStateViews();
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
    this.applyReconnectStyle(sessionId, player.isReconnecting);

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
      this.applyReconnectStyle(sessionId, player.isReconnecting);
    });
  }

  private addRosterView(
    sessionId: string,
    player: PlayerState,
    $: ReturnType<typeof getStateCallbacks<JumperRoomState>>,
  ): void {
    const bg = this.add.graphics();
    const swatch = this.add.circle(14, 13, 6, player.color);
    const label = this.add.text(26, 7, this.playerDisplayName(player, sessionId), {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#f0f0f0",
    });
    const container = this.add.container(0, 0, [bg, swatch, label])
      .setScrollFactor(0)
      .setDepth(101);

    this.rosterViews.set(sessionId, { container, bg, swatch, label });
    this.drawRosterChip(sessionId, player);
    this.applyReconnectStyle(sessionId, player.isReconnecting);
    this.layoutRoster();

    $(player).onChange(() => {
      this.drawRosterChip(sessionId, player);
      this.applyReconnectStyle(sessionId, player.isReconnecting);
    });
  }

  private drawRosterChip(sessionId: string, player: PlayerState): void {
    const roster = this.rosterViews.get(sessionId);
    if (!roster) return;
    roster.bg.clear();
    roster.bg.fillStyle(0x24243f, 0.94);
    roster.bg.lineStyle(1, player.isReconnecting ? 0x56ccf2 : 0x3a3a58, player.isReconnecting ? 0.9 : 0.65);
    roster.bg.fillRoundedRect(0, 0, 168, 26, 6);
    roster.bg.strokeRoundedRect(0.5, 0.5, 167, 25, 6);
    roster.swatch.setFillStyle(player.color);
    roster.label.setText(this.playerDisplayName(player, sessionId));
  }

  private layoutRoster(): void {
    const panelWidth = 188;
    const chipHeight = 26;
    const gap = 6;
    const pad = 8;
    const count = this.rosterViews.size;
    const panelHeight = count === 0 ? 0 : count * chipHeight + Math.max(0, count - 1) * gap + pad * 2;
    const x = this.scale.width - panelWidth - 12;
    const y = 12;

    this.rosterPanel.clear();
    if (count > 0) {
      this.rosterPanel.fillStyle(0x1a1a2e, 0.92);
      this.rosterPanel.lineStyle(1, 0x56ccf2, 0.32);
      this.rosterPanel.fillRoundedRect(x, y, panelWidth, panelHeight, 8);
      this.rosterPanel.strokeRoundedRect(x + 0.5, y + 0.5, panelWidth - 1, panelHeight - 1, 8);
    }

    [...this.rosterViews.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([, roster], index) => {
      roster.container.setPosition(x + pad, y + pad + index * (chipHeight + gap));
    });
  }

  private applyReconnectStyle(sessionId: string, isReconnecting: boolean): void {
    const alpha = isReconnecting ? 0.5 : 1;
    const player = this.playerViews.get(sessionId);
    if (player) {
      player.shadow.setAlpha(alpha);
      player.body.setAlpha(alpha);
      player.label.setAlpha(alpha);
    }

    const roster = this.rosterViews.get(sessionId);
    if (!roster) return;
    roster.container.setAlpha(isReconnecting ? 0.88 : 1);
    if (isReconnecting) {
      if (!roster.pulse) {
        roster.pulse = this.tweens.add({
          targets: roster.bg,
          alpha: { from: 0.45, to: 1 },
          duration: 650,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    } else if (roster.pulse) {
      roster.pulse.stop();
      roster.pulse = undefined;
      roster.bg.setAlpha(1);
    }
  }

  private removePlayerView(sessionId: string): void {
    const view = this.playerViews.get(sessionId);
    if (!view) return;
    view.shadow.destroy();
    view.body.destroy();
    view.label.destroy();
    this.playerViews.delete(sessionId);
  }

  private removeRosterView(sessionId: string): void {
    const roster = this.rosterViews.get(sessionId);
    if (!roster) return;
    roster.pulse?.stop();
    roster.container.destroy();
    this.rosterViews.delete(sessionId);
    this.layoutRoster();
  }

  private clearPlayerStateViews(): void {
    for (const id of [...this.playerViews.keys()]) this.removePlayerView(id);
    for (const id of [...this.rosterViews.keys()]) this.removeRosterView(id);
    this.rosterPanel.clear();
  }

  private playerDisplayName(player: PlayerState, sessionId: string): string {
    const name = player.name || `P-${sessionId.slice(0, 4)}`;
    return name.length > 18 ? `${name.slice(0, 17)}...` : name;
  }

  private updateCount(): void {
    const n = this.room?.state.players.size ?? 0;
    this.playerCountText.setText(`${n}/? players`);
  }

  override update(): void {
    if (!this.room) return;
    this.updateCameraTarget();
    this.drawEdgeIndicators();
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
