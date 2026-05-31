import { Room, Client } from "colyseus";
import { JumperRoomState, PlayerState } from "@jumper/shared";

const TICK_RATE = 20;
const MOVE_SPEED = 4;
// Chain Trail coop verb (SMA-230): when two players jump within radius+window, link them.
export const CHAIN_RADIUS_TILES = 5;
export const CHAIN_WINDOW_MS = 1200;
export const CHAIN_BREAK_MS = 1500;
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
  private recentJumps = new Map<string, { t: number; x: number; y: number }>();
  // Overridable in tests so chain-window math doesn't rely on wall clock.
  protected now(): number { return Date.now(); }

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

    try {
      await this.allowReconnection(client, reconnectWindowSec());
      console.log(`[JumperRoom] player reconnected: ${client.sessionId}`);
      this.reconnecting.delete(client.sessionId);
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
    this.recentJumps.delete(sessionId);
  }

  private detectChainLink(sessionId: string, x: number, y: number): void {
    const t = this.now();
    const result = evaluateChainJump({
      sessionId, x, y, t,
      recentJumps: this.recentJumps,
      chainCount: this.state.chainCount,
      chainLastAt: this.state.chainLastAt,
    });
    this.state.chainCount = result.chainCount;
    this.state.chainLastAt = result.chainLastAt;
    if (result.partner !== null) {
      this.broadcast("chainLink", { a: result.partner, b: sessionId, count: result.chainCount });
    }
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
        this.detectChainLink(sessionId, player.x, player.y);
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

export type JumpRecord = { t: number; x: number; y: number };
export type ChainEvalInput = {
  sessionId: string;
  x: number;
  y: number;
  t: number;
  recentJumps: Map<string, JumpRecord>;
  chainCount: number;
  chainLastAt: number;
};
export type ChainEvalResult = {
  chainCount: number;
  chainLastAt: number;
  partner: string | null;
};

// Pure chain-link evaluator. Mutates `recentJumps` (registers this jump) but
// otherwise side-effect free so it can be unit tested directly.
export function evaluateChainJump(input: ChainEvalInput): ChainEvalResult {
  const { sessionId, x, y, t, recentJumps } = input;
  let { chainCount, chainLastAt } = input;
  if (chainCount > 0 && t - chainLastAt > CHAIN_BREAK_MS) chainCount = 0;
  let partner: string | null = null;
  for (const [otherId, jump] of recentJumps) {
    if (otherId === sessionId) continue;
    if (t - jump.t > CHAIN_WINDOW_MS) continue;
    const dx = jump.x - x, dy = jump.y - y;
    if (dx * dx + dy * dy <= CHAIN_RADIUS_TILES * CHAIN_RADIUS_TILES) {
      partner = otherId;
      break;
    }
  }
  recentJumps.set(sessionId, { t, x, y });
  if (partner !== null) {
    chainCount += 1;
    chainLastAt = t;
  }
  return { chainCount, chainLastAt, partner };
}
