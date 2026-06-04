import Phaser from "phaser";
import { Client, Room, getStateCallbacks } from "colyseus.js";
import {
  cloneRoomDocument,
  createDefaultRoomDocument,
  validateRoomDocument,
  type JumperRoomState,
  type PlayerState,
  type RoomDocument,
  type RoomValidationResult,
} from "@jumper/shared";

// In dev, Vite proxies Colyseus traffic from the page port to the game server.
// In production, serve client and server from the same origin.
const SERVER_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

// Isometric projection
const TILE_W = 64;
const TILE_H = 32;
const WORLD_SIZE = 50;

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
  private editorStatusText!: Phaser.GameObjects.Text;
  private tileLayer?: Phaser.GameObjects.Graphics;
  private wallLayer?: Phaser.GameObjects.Graphics;
  private spawnMarker?: Phaser.GameObjects.Arc;
  private room?: Room<JumperRoomState>;
  private roomDocument: RoomDocument = createDefaultRoomDocument();
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
    this.redrawRoomDocument();

    this.statusText = this.add.text(8, 8, "Connecting...", {
      fontFamily: "monospace", fontSize: "13px", color: "#ffffff",
    }).setScrollFactor(0).setDepth(100);

    this.playerCountText = this.add.text(8, 28, "", {
      fontFamily: "monospace", fontSize: "13px", color: "#aaffaa",
    }).setScrollFactor(0).setDepth(100);

    this.add.text(8, this.scale.height - 20, "WASD/Arrows: move  |  Space: jump", {
      fontFamily: "monospace", fontSize: "11px", color: "#888888",
    }).setScrollFactor(0).setDepth(100);

    this.editorStatusText = this.add.text(this.scale.width - 8, 8, "", {
      fontFamily: "monospace", fontSize: "12px", color: "#ffffff",
      backgroundColor: "#00000088", padding: { x: 5, y: 4 },
      align: "right",
      wordWrap: { width: 360 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.refreshEditorStatus();
    this.createRoomEditorControls();

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

  private redrawRoomDocument(): void {
    this.tileLayer?.destroy();
    this.wallLayer?.destroy();
    this.spawnMarker?.destroy();

    const g = this.add.graphics().setDepth(0);
    this.tileLayer = g;
    for (let ty = 0; ty < this.roomDocument.bounds.height; ty++) {
      for (let tx = 0; tx < this.roomDocument.bounds.width; tx++) {
        const { x, y } = isoToScreen(tx, ty);
        const sx = x + this.originX;
        const sy = y + this.originY;
        const isSolid = this.isSolidTile(tx, ty);
        const color = isSolid
          ? ((tx + ty) % 2 === 0 ? 0x5b8c3e : 0x3d6b2e)
          : ((tx + ty) % 2 === 0 ? 0x4f6f83 : 0x3f5b70);
        const hw = TILE_W / 2, hh = TILE_H / 2;
        g.fillStyle(color, isSolid ? 1 : 0.55);
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
    this.drawRoomWalls();
    const spawn = this.screenPos(this.roomDocument.spawn.x, this.roomDocument.spawn.y, this.roomDocument.spawn.z ?? 0);
    this.spawnMarker = this.add.circle(spawn.x, spawn.y - 6, 8, 0xffffff, 0.92)
      .setStrokeStyle(2, 0x111111, 0.9)
      .setDepth((this.roomDocument.spawn.x + this.roomDocument.spawn.y) * 10 + 4);
  }

  private drawRoomWalls(): void {
    const g = this.add.graphics().setDepth(1);
    this.wallLayer = g;
    g.lineStyle(4, 0x2b2520, 0.9);
    for (const wall of this.roomDocument.walls ?? []) {
      const center = this.screenPos(wall.x, wall.y, 0);
      const hw = TILE_W / 2, hh = TILE_H / 2;
      const points = {
        north: [{ x: center.x - hw, y: center.y }, { x: center.x, y: center.y - hh }],
        east: [{ x: center.x, y: center.y - hh }, { x: center.x + hw, y: center.y }],
        south: [{ x: center.x + hw, y: center.y }, { x: center.x, y: center.y + hh }],
        west: [{ x: center.x, y: center.y + hh }, { x: center.x - hw, y: center.y }],
      }[wall.edge];
      g.strokePoints(points, false);
    }
  }

  private isSolidTile(x: number, y: number): boolean {
    if ((this.roomDocument.tiles ?? []).some((tile) => tile.x === x && tile.y === y && tile.solid !== false)) return true;
    return (this.roomDocument.platforms ?? []).some((platform) => (
      platform.solid !== false &&
      x >= platform.x &&
      y >= platform.y &&
      x < platform.x + platform.width &&
      y < platform.y + platform.height
    ));
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

  private createRoomEditorControls(): void {
    const root = document.createElement("div");
    root.style.position = "fixed";
    root.style.right = "8px";
    root.style.bottom = "8px";
    root.style.zIndex = "20";
    root.style.display = "grid";
    root.style.gridTemplateColumns = "repeat(4, auto)";
    root.style.gap = "6px";
    root.style.fontFamily = "monospace";
    root.style.fontSize = "12px";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      void this.importRoomFile(file);
      fileInput.value = "";
    });
    root.appendChild(fileInput);

    root.appendChild(this.makeButton("Import", () => fileInput.click()));
    root.appendChild(this.makeButton("Export", () => void this.exportRoom()));
    root.appendChild(this.makeButton("Save Dev", () => void this.saveRoomToDevEndpoint()));
    root.appendChild(this.makeButton("Validate", () => this.refreshEditorStatus()));
    root.appendChild(this.makeButton("Spawn W", () => this.moveSpawn(-1, 0)));
    root.appendChild(this.makeButton("Spawn E", () => this.moveSpawn(1, 0)));
    root.appendChild(this.makeButton("Spawn N", () => this.moveSpawn(0, -1)));
    root.appendChild(this.makeButton("Spawn S", () => this.moveSpawn(0, 1)));
    document.body.appendChild(root);
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.padding = "5px 8px";
    button.style.border = "1px solid #ffffff66";
    button.style.borderRadius = "4px";
    button.style.background = "#111827dd";
    button.style.color = "#ffffff";
    button.style.cursor = "pointer";
    button.addEventListener("click", onClick);
    return button;
  }

  private async importRoomFile(file: File): Promise<void> {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const validation = validateRoomDocument(parsed);
      if (!validation.ok) {
        this.refreshEditorStatus(validation);
        return;
      }
      this.roomDocument = cloneRoomDocument(parsed as RoomDocument);
      this.redrawRoomDocument();
      this.refreshEditorStatus(validation, `Loaded ${file.name}`);
    } catch (err) {
      this.refreshEditorStatus({ ok: false, errors: [`Import failed: ${(err as Error).message}`] });
    }
  }

  private moveSpawn(dx: number, dy: number): void {
    this.roomDocument = cloneRoomDocument(this.roomDocument);
    this.roomDocument.spawn.x = Math.max(0, Math.min(this.roomDocument.bounds.width - 1, this.roomDocument.spawn.x + dx));
    this.roomDocument.spawn.y = Math.max(0, Math.min(this.roomDocument.bounds.height - 1, this.roomDocument.spawn.y + dy));
    this.redrawRoomDocument();
    this.refreshEditorStatus();
  }

  private async exportRoom(): Promise<void> {
    const validation = validateRoomDocument(this.roomDocument);
    if (!validation.ok) {
      this.refreshEditorStatus(validation, "Export blocked");
      return;
    }
    const json = `${JSON.stringify(this.roomDocument, null, 2)}\n`;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${this.roomDocument.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    try {
      await navigator.clipboard.writeText(json);
      this.refreshEditorStatus(validation, "Exported and copied");
    } catch {
      this.refreshEditorStatus(validation, "Exported");
    }
  }

  private async saveRoomToDevEndpoint(): Promise<void> {
    const validation = validateRoomDocument(this.roomDocument);
    if (!validation.ok) {
      this.refreshEditorStatus(validation, "Save blocked");
      return;
    }
    try {
      const response = await fetch(`/dev/rooms/${encodeURIComponent(this.roomDocument.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(this.roomDocument),
      });
      const result = await response.json() as { ok?: boolean; errors?: string[]; path?: string };
      if (!response.ok || !result.ok) {
        this.refreshEditorStatus({ ok: false, errors: result.errors ?? [`Save failed with ${response.status}`] }, "Save failed");
        return;
      }
      this.refreshEditorStatus(validation, `Saved ${result.path ?? this.roomDocument.id}`);
    } catch (err) {
      this.refreshEditorStatus({ ok: false, errors: [(err as Error).message] }, "Save unavailable");
    }
  }

  private refreshEditorStatus(validation = validateRoomDocument(this.roomDocument), prefix?: string): void {
    if (!this.editorStatusText) return;
    const header = `${prefix ? `${prefix} | ` : ""}${this.roomDocument.id} | ${this.roomDocument.bounds.width}x${this.roomDocument.bounds.height}`;
    const body = validation.ok ? "Validation: OK" : `Validation: ${validation.errors.slice(0, 3).join("; ")}`;
    this.editorStatusText.setText(`${header}\n${body}`);
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
