import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, Room as ClientRoom } from "colyseus.js";
import { JumperRoom } from "../JumperRoom";

const TEST_PORT = 29567;
const ENDPOINT = `ws://localhost:${TEST_PORT}`;

let server: Server;

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForState(
  room: ClientRoom,
  predicate: (state: any) => boolean,
  timeoutMs = 3000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("waitForState timed out")), timeoutMs);
    const check = () => {
      try {
        if (room.state?.players && predicate(room.state)) {
          clearTimeout(timer);
          resolve();
        }
      } catch {
        // state not yet ready; wait for next change
      }
    };
    room.onStateChange(check);
    check();
  });
}

beforeAll(async () => {
  // Shorten reconnect window so the dropout test runs quickly.
  process.env.JUMPER_RECONNECT_WINDOW_SEC = "2";
  server = new Server({ transport: new WebSocketTransport() });
  server.define("jumper", JumperRoom);
  await server.listen(TEST_PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

describe("JumperRoom", () => {
  let rooms: ClientRoom[] = [];

  afterEach(async () => {
    for (const r of rooms) {
      try { r.leave(); } catch {}
    }
    rooms = [];
    await wait(100);
  });

  async function joinRoom(): Promise<ClientRoom> {
    const client = new Client(ENDPOINT);
    const room = await client.joinOrCreate("jumper");
    rooms.push(room);
    return room;
  }

  describe("room create + join", () => {
    it("creates a room and assigns a player on join", async () => {
      const room = await joinRoom();
      await waitForState(room, (s) => s.players.size > 0);

      expect(room.state.players.size).toBe(1);
      const player = room.state.players.get(room.sessionId);
      expect(player).toBeDefined();
      expect(player.id).toBe(room.sessionId);
      expect(player.name).toContain("P-");
      expect(player.x).toBeGreaterThan(0);
      expect(player.y).toBeGreaterThan(0);
      expect(player.z).toBe(0);
      expect(player.isJumping).toBe(false);
      expect(player.isReconnecting).toBe(false);
    });
  });

  describe("two clients join/leave visibility", () => {
    it("two clients see each other in the same room", async () => {
      const room1 = await joinRoom();
      await waitForState(room1, (s) => s.players.size === 1);

      const room2 = await joinRoom();
      await waitForState(room1, (s) => s.players.size === 2);
      await waitForState(room2, (s) => s.players.size === 2);

      expect(room1.state.players.get(room2.sessionId)).toBeDefined();
      expect(room2.state.players.get(room1.sessionId)).toBeDefined();
    });

    it("client sees the other leave", async () => {
      const room1 = await joinRoom();
      const room2 = await joinRoom();
      await waitForState(room1, (s) => s.players.size === 2);

      room2.leave();
      rooms = rooms.filter((r) => r !== room2);
      await waitForState(room1, (s) => s.players.size === 1);

      expect(room1.state.players.get(room2.sessionId)).toBeUndefined();
    });
  });

  describe("movement state propagation", () => {
    it("player position changes after movement input", async () => {
      const room = await joinRoom();
      await waitForState(room, (s) => s.players.size === 1);

      const player = room.state.players.get(room.sessionId)!;
      const startX = player.x;

      room.send("input", { left: false, right: true, up: false, down: false, jump: false });
      await wait(200);

      expect(room.state.players.get(room.sessionId)!.x).toBeGreaterThan(startX);
    });

    it("second client sees first client move", async () => {
      const room1 = await joinRoom();
      const room2 = await joinRoom();
      await waitForState(room2, (s) => s.players.size === 2);

      const startX = room2.state.players.get(room1.sessionId)!.x;

      room1.send("input", { left: false, right: true, up: false, down: false, jump: false });
      await wait(200);

      expect(room2.state.players.get(room1.sessionId)!.x).toBeGreaterThan(startX);
    });
  });

  describe("reconnect + dropout", () => {
    it("client can reconnect within window and state is preserved", async () => {
      const client1 = new Client(ENDPOINT);
      const room1 = await client1.joinOrCreate("jumper");
      rooms.push(room1);
      await waitForState(room1, (s) => s.players.size === 1);

      // Move so we have non-default state to verify after reconnect.
      room1.send("input", { left: false, right: true, up: false, down: false, jump: false });
      await wait(250);
      const sessionId = room1.sessionId;
      const reconnectionToken = room1.reconnectionToken;
      const xBeforeDrop = room1.state.players.get(sessionId)!.x;
      expect(xBeforeDrop).toBeGreaterThan(0);

      // Simulate unconsented disconnect by closing the underlying socket.
      (room1 as any).connection.transport.ws.close();
      rooms = rooms.filter((r) => r !== room1);
      await wait(300);

      // Reconnect — must reuse the same sessionId and find existing player state.
      const client2 = new Client(ENDPOINT);
      const room2 = await client2.reconnect(reconnectionToken);
      rooms.push(room2);
      await waitForState(room2, (s) => s.players.size >= 1);

      expect(room2.sessionId).toBe(sessionId);
      const restored = room2.state.players.get(sessionId);
      expect(restored).toBeDefined();
      expect(restored.x).toBeCloseTo(xBeforeDrop, 0);
      expect(restored.isReconnecting).toBe(false);
    });

    it("marks dropped players reconnecting and clears the flag on reconnect", async () => {
      const client1 = new Client(ENDPOINT);
      const room1 = await client1.joinOrCreate("jumper");
      rooms.push(room1);
      const room2 = await joinRoom();
      await waitForState(room2, (s) => s.players.size === 2);

      const droppedSessionId = room1.sessionId;
      const reconnectionToken = room1.reconnectionToken;
      (room1 as any).connection.transport.ws.close();
      rooms = rooms.filter((r) => r !== room1);

      await waitForState(room2, (s) => s.players.get(droppedSessionId)?.isReconnecting === true);
      expect(room2.state.players.get(droppedSessionId)!.isReconnecting).toBe(true);

      const client2 = new Client(ENDPOINT);
      const room1Reconnected = await client2.reconnect(reconnectionToken);
      rooms.push(room1Reconnected);

      await waitForState(room2, (s) => s.players.get(droppedSessionId)?.isReconnecting === false);
      expect(room2.state.players.get(droppedSessionId)!.isReconnecting).toBe(false);
      expect(room1Reconnected.sessionId).toBe(droppedSessionId);
    });

    it("dropout after window removes avatar; other players unaffected", async () => {
      const client1 = new Client(ENDPOINT);
      const room1 = await client1.joinOrCreate("jumper");
      rooms.push(room1);
      const room2 = await joinRoom();
      await waitForState(room1, (s) => s.players.size === 2);

      const droppedSessionId = room1.sessionId;
      (room1 as any).connection.transport.ws.close();
      rooms = rooms.filter((r) => r !== room1);

      // Reconnect window is 2s in tests; wait past it.
      await waitForState(room2, (s) => !s.players.get(droppedSessionId), 6000);

      expect(room2.state.players.size).toBe(1);
      expect(room2.state.players.get(droppedSessionId)).toBeUndefined();
      expect(room2.state.players.get(room2.sessionId)).toBeDefined();
    });
  });

  describe("jump state transition", () => {
    it("jump input sets isJumping and positive z", async () => {
      const room = await joinRoom();
      await waitForState(room, (s) => s.players.size === 1);

      room.send("input", { left: false, right: false, up: false, down: false, jump: true });
      await wait(150);

      const player = room.state.players.get(room.sessionId)!;
      expect(player.isJumping).toBe(true);
      expect(player.z).toBeGreaterThan(0);
    });

    it("player lands after jumping (z returns to 0)", async () => {
      const room = await joinRoom();
      await waitForState(room, (s) => s.players.size === 1);

      room.send("input", { left: false, right: false, up: false, down: false, jump: true });
      await wait(150);
      room.send("input", { left: false, right: false, up: false, down: false, jump: false });

      await waitForState(room, (s) => {
        const p = s.players.get(room.sessionId);
        return p && !p.isJumping && p.z === 0;
      }, 5000);

      const player = room.state.players.get(room.sessionId)!;
      expect(player.isJumping).toBe(false);
      expect(player.z).toBe(0);
    });
  });
});
