import { describe, it, expect } from "vitest";
import {
  evaluateChainJump,
  CHAIN_RADIUS_TILES,
  CHAIN_WINDOW_MS,
  CHAIN_BREAK_MS,
  type JumpRecord,
} from "../JumperRoom";

function jump(recent: Map<string, JumpRecord>, sessionId: string, x: number, y: number, t: number, count = 0, lastAt = 0) {
  return evaluateChainJump({ sessionId, x, y, t, recentJumps: recent, chainCount: count, chainLastAt: lastAt });
}

describe("evaluateChainJump (Chain Trail)", () => {
  it("solo player jumping repeatedly never increments chain", () => {
    const recent = new Map<string, JumpRecord>();
    let count = 0, lastAt = 0;
    for (let i = 0; i < 5; i++) {
      const r = jump(recent, "A", 10, 10, i * 200, count, lastAt);
      count = r.chainCount;
      lastAt = r.chainLastAt;
      expect(r.partner).toBeNull();
    }
    expect(count).toBe(0);
  });

  it("two players within radius and window → chain increments to 1", () => {
    const recent = new Map<string, JumpRecord>();
    const r1 = jump(recent, "A", 10, 10, 1000);
    expect(r1.chainCount).toBe(0);
    const r2 = jump(recent, "B", 12, 11, 1000 + 800, r1.chainCount, r1.chainLastAt);
    expect(r2.partner).toBe("A");
    expect(r2.chainCount).toBe(1);
    expect(r2.chainLastAt).toBe(1800);
  });

  it("two players outside radius do not link within window", () => {
    const recent = new Map<string, JumpRecord>();
    const r1 = jump(recent, "A", 10, 10, 0);
    // Distance = 6 tiles > CHAIN_RADIUS_TILES (5)
    const r2 = jump(recent, "B", 10 + CHAIN_RADIUS_TILES + 1, 10, 500, r1.chainCount, r1.chainLastAt);
    expect(r2.partner).toBeNull();
    expect(r2.chainCount).toBe(0);
  });

  it("two players within radius but past window do not link", () => {
    const recent = new Map<string, JumpRecord>();
    const r1 = jump(recent, "A", 10, 10, 0);
    const r2 = jump(recent, "B", 11, 10, CHAIN_WINDOW_MS + 1, r1.chainCount, r1.chainLastAt);
    expect(r2.partner).toBeNull();
    expect(r2.chainCount).toBe(0);
  });

  it("chain resets to 1 after CHAIN_BREAK_MS silence", () => {
    const recent = new Map<string, JumpRecord>();
    const r1 = jump(recent, "A", 10, 10, 0);
    const r2 = jump(recent, "B", 11, 10, 500, r1.chainCount, r1.chainLastAt);
    expect(r2.chainCount).toBe(1);

    // Wait past break window, then a fresh qualifying pair.
    const t = 500 + CHAIN_BREAK_MS + 100;
    const r3 = jump(recent, "A", 20, 20, t, r2.chainCount, r2.chainLastAt);
    expect(r3.chainCount).toBe(0); // reset on first jump after silence, no partner in window
    const r4 = jump(recent, "B", 21, 20, t + 200, r3.chainCount, r3.chainLastAt);
    expect(r4.partner).toBe("A");
    expect(r4.chainCount).toBe(1);
  });
});
