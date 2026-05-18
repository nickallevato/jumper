import Phaser from "phaser";
import { Client, Room, getStateCallbacks } from "colyseus.js";
import type { JumperRoomState, PlayerState } from "@jumper/shared";

const SERVER_URL = `ws://${window.location.hostname}:2567`;

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

  private drawTiles(): void {
    const g = this.add.graphics().setDepth(0);
    for (let ty = 0; ty < WORLD_SIZE; ty++) {
      for (let tx = 0; tx < WORLD_SIZE; tx++) {
        const { x, y } = isoToScreen(tx, ty);
        const sx = x + this.originX;
        const sy = y + this.originY;
        const color = (tx + ty) % 2 === 0 ? 0x2d5a27 : 0x3a7a33;
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

  private async connect(): Promise<void> {
    try {
      const client = new Client(SERVER_URL);
      const room = await client.joinOrCreate<JumperRoomState>("jumper");
      this.room = room;
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

      room.onLeave(() => {
        this.statusText.setText("Disconnected — refresh to rejoin");
        for (const id of [...this.playerViews.keys()]) this.removePlayerView(id);
        this.playerCountText.setText("Players: 0");
      });
    } catch (err) {
      console.error("[client] connect failed", err);
      this.statusText.setText(`Connect failed: ${(err as Error).message}`);
    }
  }

  private addPlayerView(
    sessionId: string,
    player: PlayerState,
    $: ReturnType<typeof getStateCallbacks<JumperRoomState>>,
  ): void {
    const isSelf = this.room?.sessionId === sessionId;
    const pos = this.screenPos(player.x, player.y, player.z);
    const groundPos = this.screenPos(player.x, player.y, 0);

    const shadow = this.add.ellipse(groundPos.x, groundPos.y + 4, 28, 10, 0x000000, 0.35).setDepth(1);
    const body = this.add.circle(pos.x, pos.y, 14, player.color).setDepth(2);
    body.setStrokeStyle(isSelf ? 3 : 1, isSelf ? 0xffffff : 0x333333);
    const label = this.add.text(pos.x, pos.y - 22, player.name || sessionId.slice(0, 4), {
      fontFamily: "monospace", fontSize: "11px", color: "#ffffff",
      backgroundColor: "#00000066", padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 1).setDepth(3);

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
      // Squash/stretch: stretch up on ascent, squash on landing approach
      const stretchY = player.isJumping ? (player.velZ > 0 ? 1.3 : 0.85) : 1;
      view.body.setScale(1 / stretchY, stretchY);
      view.label.setPosition(p.x, p.y - 22);
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
    this.playerCountText.setText(`Players: ${n}`);
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
  backgroundColor: "#0a0a14",
  scene: [GameScene],
};

new Phaser.Game(config);
