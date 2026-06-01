import { describe, expect, it } from 'vitest'
import {
  pushSnapshot,
  sampleSnapshots,
  pruneSnapshots,
  REMOTE_RENDER_DELAY_MS,
} from '../client/src/interpolation.js'

describe('remote entity snapshot interpolation', () => {
  it('returns null for an empty buffer', () => {
    expect(sampleSnapshots([], 100)).toBeNull()
  })

  it('returns the only snapshot when the buffer has one entry', () => {
    const buf = [{ t: 0, x: 5, y: 5, z: 0 }]
    expect(sampleSnapshots(buf, 100)).toEqual({ x: 5, y: 5, z: 0 })
  })

  it('linearly interpolates between the two surrounding snapshots', () => {
    const buf = [
      { t: 0, x: 0, y: 0, z: 0 },
      { t: 100, x: 10, y: 20, z: 2 },
    ]
    // halfway in time -> halfway in space
    expect(sampleSnapshots(buf, 50)).toEqual({ x: 5, y: 10, z: 1 })
  })

  it('produces constant-velocity motion across evenly spaced ticks', () => {
    const buf = [
      { t: 0, x: 0, y: 0, z: 0 },
      { t: 50, x: 1, y: 0, z: 0 },
      { t: 100, x: 2, y: 0, z: 0 },
    ]
    // equal time steps -> equal position steps (no easing/rubber-band)
    const a = sampleSnapshots(buf, 25).x
    const b = sampleSnapshots(buf, 50).x
    const c = sampleSnapshots(buf, 75).x
    expect(b - a).toBeCloseTo(c - b, 6)
  })

  it('holds at the last snapshot when render time is past the buffer (no overshoot)', () => {
    const buf = [
      { t: 0, x: 0, y: 0, z: 0 },
      { t: 100, x: 10, y: 0, z: 0 },
    ]
    expect(sampleSnapshots(buf, 999)).toEqual({ x: 10, y: 0, z: 0 })
  })

  it('holds at the first snapshot when render time precedes the buffer', () => {
    const buf = [
      { t: 100, x: 3, y: 3, z: 0 },
      { t: 200, x: 9, y: 3, z: 0 },
    ]
    expect(sampleSnapshots(buf, 0)).toEqual({ x: 3, y: 3, z: 0 })
  })

  it('pushSnapshot appends and caps buffer length', () => {
    let buf = []
    for (let t = 0; t < 10; t++) buf = pushSnapshot(buf, { t, x: t, y: 0, z: 0 }, 4)
    expect(buf.length).toBe(4)
    expect(buf[buf.length - 1]).toEqual({ t: 9, x: 9, y: 0, z: 0 })
    expect(buf[0]).toEqual({ t: 6, x: 6, y: 0, z: 0 })
  })

  it('pruneSnapshots keeps the snapshot bracketing renderTime', () => {
    const buf = [
      { t: 0, x: 0, y: 0, z: 0 },
      { t: 50, x: 1, y: 0, z: 0 },
      { t: 100, x: 2, y: 0, z: 0 },
      { t: 150, x: 3, y: 0, z: 0 },
    ]
    const pruned = pruneSnapshots(buf, 120)
    // must still contain the pair bracketing t=120 (t=100 and t=150)
    expect(pruned.some((s) => s.t === 100)).toBe(true)
    expect(pruned.some((s) => s.t === 150)).toBe(true)
    // stale early snapshots dropped
    expect(pruned.some((s) => s.t === 0)).toBe(false)
  })

  it('exposes a sane default render delay (>= one tick, <= a few ticks)', () => {
    expect(REMOTE_RENDER_DELAY_MS).toBeGreaterThanOrEqual(50)
    expect(REMOTE_RENDER_DELAY_MS).toBeLessThanOrEqual(200)
  })
})
