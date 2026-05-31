import { describe, it, expect } from "vitest";
import { sanitizeName, MAX_NAME_LEN } from "../JumperRoom";

const SID = "abcd1234";
const FALLBACK = `P-${SID.slice(0, 4)}`;

describe("sanitizeName", () => {
  it("returns fallback for non-string input", () => {
    expect(sanitizeName(undefined, SID)).toBe(FALLBACK);
    expect(sanitizeName(null, SID)).toBe(FALLBACK);
    expect(sanitizeName(42, SID)).toBe(FALLBACK);
    expect(sanitizeName({ name: "x" }, SID)).toBe(FALLBACK);
    expect(sanitizeName([], SID)).toBe(FALLBACK);
  });

  it("returns fallback for empty / whitespace-only strings", () => {
    expect(sanitizeName("", SID)).toBe(FALLBACK);
    expect(sanitizeName("   ", SID)).toBe(FALLBACK);
    expect(sanitizeName("\t\n  ", SID)).toBe(FALLBACK);
  });

  it("trims whitespace", () => {
    expect(sanitizeName("  Alice  ", SID)).toBe("Alice");
  });

  it("truncates to max length", () => {
    const long = "a".repeat(100);
    const out = sanitizeName(long, SID);
    expect(out.length).toBe(MAX_NAME_LEN);
    expect(out).toBe("a".repeat(MAX_NAME_LEN));
  });

  it("strips C0 control chars and DEL", () => {
    expect(sanitizeName("Al\x00ice", SID)).toBe("Alice");
    expect(sanitizeName("Al\x1Bice\x7F", SID)).toBe("Alice");
    expect(sanitizeName("\n\rA\tB\b", SID)).toBe("AB");
  });

  it("survives huge adversarial payloads", () => {
    const huge = "\x00".repeat(10_000) + "X".repeat(10_000);
    const out = sanitizeName(huge, SID);
    expect(out.length).toBeLessThanOrEqual(MAX_NAME_LEN);
    expect(out).toBe("X".repeat(MAX_NAME_LEN));
  });

  it("preserves unicode (emoji, accents)", () => {
    expect(sanitizeName("Álex", SID)).toBe("Álex");
    expect(sanitizeName("🎮Player", SID)).toBe("🎮Player");
  });
});
