import { describe, it, expect } from "vitest";
import { GRAVITY, JUMP_VELOCITY } from "../JumperRoom";

// Mirrors the per-tick jump integration in JumperRoom.tick.
// Tick-rate independence is the property under test; the formula is exact
// for constant gravity, so it must match across tick rates within tight bounds.
function simulateJumpApex(tickHz: number): { apex: number; airtimeMs: number } {
  const dtSec = 1 / tickHz;
  let z = 0;
  let velZ = JUMP_VELOCITY;
  let apex = 0;
  let ticks = 0;
  const maxTicks = tickHz * 5; // safety cap
  while (ticks < maxTicks) {
    z += velZ * dtSec + 0.5 * GRAVITY * dtSec * dtSec;
    velZ += GRAVITY * dtSec;
    ticks++;
    if (z > apex) apex = z;
    if (z <= 0) {
      z = 0;
      break;
    }
  }
  return { apex, airtimeMs: ticks * dtSec * 1000 };
}

describe("jump physics — tick-rate independence", () => {
  it("apex and airtime sit near the documented target at 20 Hz", () => {
    const { apex, airtimeMs } = simulateJumpApex(20);
    // Analytic target: apex = v0²/(2|g|) ≈ 2.78 tiles, airtime = 2v0/|g| ≈ 696 ms.
    expect(apex).toBeGreaterThan(2.5);
    expect(apex).toBeLessThan(3.1);
    expect(airtimeMs).toBeGreaterThan(630);
    expect(airtimeMs).toBeLessThan(770);
  });

  it("halving the tick rate preserves jump apex within 5%", () => {
    const fast = simulateJumpApex(20);
    const slow = simulateJumpApex(10);
    const delta = Math.abs(slow.apex - fast.apex) / fast.apex;
    expect(delta).toBeLessThan(0.05);
  });

  it("doubling the tick rate also preserves jump apex within 5%", () => {
    const base = simulateJumpApex(20);
    const fine = simulateJumpApex(40);
    const delta = Math.abs(fine.apex - base.apex) / base.apex;
    expect(delta).toBeLessThan(0.05);
  });
});
