import { Room, Client } from "colyseus";
import { JumperRoomState, PlayerState } from "@jumper/shared";

const TICK_RATE = 20;
const MOVE_SPEED = 8;
// Jump physics are tick-rate independent: gravity is integrated by dtSec.
// Target feel: apex ≈ 2.78 tiles, airtime ≈ 700 ms (analytic: v0²/(2|g|), 2v0/|g|).
// JUMP_VELOCITY: initial vertical velocity, tiles/s.
// GRAVITY:       vertical acceleration, tiles/s² (negative = downward).
export const JUMP_VELOCITY = 16;
export const GRAVITY = -46;
const JUMP_COOLDOWN_MS = 350;
const WORLD_SIZE = 50;
const RECONNECT_WINDOW_SEC_DEFAULT = 30;
function reconnectWindowSec(): number {
  const v = Number(process.env.JUMPER_RECONNECT_WINDOW_SEC);
  return Number.isFinite(v) && v > 0 ? v : RECONNECT_WINDOW_SEC_DEFAULT;
}
const COLORS = [0xe85d4a, 0x4a90d9, 0xf2c94c, 0x6fcf97, 0xbb6bd9, 0xf2994a, 0xeb5757, 0x2d9cdb];

type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean };

export class JumperRoom extends Room<JumperRoomState> {
  override maxClients = 32;
  override autoDispose = true;
  private inputs = new Map<string, Input>();
  private pendingJump = new Set<string>();
  private reconnecting = new Set<string>();
  private colorIndex = 0;

  override onCreate(): void {
    this.state = new JumperRoomState();
    this.setSimulationInterval((dt) => this.tick(dt), 1000 / TICK_RATE);
    this.onMessage("input", (client, input: Input) => {
      const prev = this.inputs.get(client.sessionId);
      if (input.jump || prev?.jump) this.pendingJump.add(client.sessionId);
      this.inputs.set(client.sessionId, input);
    });
    console.log(`[JumperRoom] created (${this.roomId})`);
  }

  override onJoin(client: Client): void {
    const existing = this.state.players.get(client.sessionId);
    if (existing) {
      console.log(`[JumperRoom] player rejoined: ${client.sessionId}`);
      this.reconnecting.delete(client.sessionId);
      existing.isReconnecting = false;
      if (!this.inputs.has(client.sessionId)) {
        this.inputs.set(client.sessionId, { left: false, right: false, up: false, down: false, jump: false });
      }
      return;
    }

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

  override async onLeave(client: Client, consented?: boolean): Promise<void> {
    // Clear inputs so the avatar stops moving while we wait for reconnect.
    this.inputs.set(client.sessionId, { left: false, right: false, up: false, down: false, jump: false });
    this.pendingJump.delete(client.sessionId);

    if (consented) {
      console.log(`[JumperRoom] player left (consented): ${client.sessionId}`);
      this.removePlayer(client.sessionId);
      return;
    }

    console.log(`[JumperRoom] player disconnected, awaiting reconnect: ${client.sessionId}`);
    this.reconnecting.add(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (player) player.isReconnecting = true;

    try {
      await this.allowReconnection(client, reconnectWindowSec());
      console.log(`[JumperRoom] player reconnected: ${client.sessionId}`);
      this.reconnecting.delete(client.sessionId);
      const reconnectedPlayer = this.state.players.get(client.sessionId);
      if (reconnectedPlayer) reconnectedPlayer.isReconnecting = false;
    } catch {
      console.log(`[JumperRoom] reconnect window expired, dropping: ${client.sessionId}`);
      this.reconnecting.delete(client.sessionId);
      this.removePlayer(client.sessionId);
    }
  }

  private removePlayer(sessionId: string): void {
    this.state.players.delete(sessionId);
    this.inputs.delete(sessionId);
    this.pendingJump.delete(sessionId);
  }

  private tick(dt: number): void {
    const dtSec = dt / 1000;
    this.state.players.forEach((player, sessionId) => {
      const input = this.inputs.get(sessionId);
      if (!input) return;
      if (this.reconnecting.has(sessionId)) {
        // Freeze physics for disconnected players until reconnect or timeout.
        return;
      }

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
        // Exact integration under constant gravity — tick-rate independent.
        player.z += player.velZ * dtSec + 0.5 * GRAVITY * dtSec * dtSec;
        player.velZ += GRAVITY * dtSec;
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
