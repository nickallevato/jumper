import { Room, Client } from "colyseus";
import { JumperRoomState, PlayerState } from "@jumper/shared";

const TICK_RATE = 20;
const MOVE_SPEED = 4;
const JUMP_VELOCITY = 14;
const GRAVITY = -1.2;
const JUMP_COOLDOWN_MS = 350;
const WORLD_SIZE = 50;
const COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xe91e63];

type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean };

export class JumperRoom extends Room<JumperRoomState> {
  override maxClients = 32;
  private inputs = new Map<string, Input>();
  private pendingJump = new Set<string>();
  private colorIndex = 0;

  override onCreate(): void {
    this.state = new JumperRoomState();
    this.setSimulationInterval((dt) => this.tick(dt), 1000 / TICK_RATE);
    this.onMessage("input", (client, input: Input) => {
      // Latch jump: once set true, keep pending until tick consumes it
      const prev = this.inputs.get(client.sessionId);
      if (input.jump || prev?.jump) this.pendingJump.add(client.sessionId);
      this.inputs.set(client.sessionId, input);
    });
    console.log(`[JumperRoom] created (${this.roomId})`);
  }

  override onJoin(client: Client): void {
    console.log(`[JumperRoom] player joined: ${client.sessionId}`);
    const player = new PlayerState();
    player.id = client.sessionId;
    player.x = WORLD_SIZE / 2 + (Math.random() * 10 - 5);
    player.y = WORLD_SIZE / 2 + (Math.random() * 10 - 5);
    player.z = 0;
    player.color = COLORS[this.colorIndex++ % COLORS.length]!;
    player.name = `P-${client.sessionId.slice(0, 4)}`;
    this.state.players.set(client.sessionId, player);
    this.inputs.set(client.sessionId, { left: false, right: false, up: false, down: false, jump: false });
  }

  override onLeave(client: Client): void {
    console.log(`[JumperRoom] player left: ${client.sessionId}`);
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.pendingJump.delete(client.sessionId);
  }

  private tick(dt: number): void {
    const dtSec = dt / 1000;
    this.state.players.forEach((player, sessionId) => {
      const input = this.inputs.get(sessionId);
      if (!input) return;

      let dx = 0, dy = 0;
      if (input.left) dx -= MOVE_SPEED * dtSec;
      if (input.right) dx += MOVE_SPEED * dtSec;
      if (input.up) dy -= MOVE_SPEED * dtSec;
      if (input.down) dy += MOVE_SPEED * dtSec;
      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

      player.x = Math.max(0, Math.min(WORLD_SIZE - 1, player.x + dx));
      player.y = Math.max(0, Math.min(WORLD_SIZE - 1, player.y + dy));

      if (player.jumpCooldown > 0) {
        player.jumpCooldown = Math.max(0, player.jumpCooldown - dt);
      }
      const wantsJump = this.pendingJump.has(sessionId);
      if (wantsJump && !player.isJumping && player.jumpCooldown <= 0) {
        player.isJumping = true;
        player.velZ = JUMP_VELOCITY;
        player.jumpCooldown = JUMP_COOLDOWN_MS;
        this.pendingJump.delete(sessionId);
      }

      if (player.isJumping) {
        player.velZ += GRAVITY;
        player.z += player.velZ * dtSec * 8;
        if (player.z <= 0) {
          player.z = 0;
          player.velZ = 0;
          player.isJumping = false;
        }
      }
    });
  }

  override onDispose(): void {
    console.log(`[JumperRoom] disposed (${this.roomId})`);
  }
}
