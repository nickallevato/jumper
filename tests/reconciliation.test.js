import { describe, expect, it } from 'vitest'
import {
  LOCAL_RECONCILE_XY_THRESHOLD,
  LOCAL_RECONCILE_Z_THRESHOLD,
  localServerDivergence,
  shouldApplyLocalServerCorrection,
  reconcilePrediction,
  pruneAckedInputs,
} from '../client/src/reconciliation.js'

describe('local player server reconciliation', () => {
  it('ignores normal prediction drift from a stale server tick', () => {
    const local = { tx: 8.2, ty: 8, tz: 0.42 }
    const server = { x: 8.0, y: 8.02, z: 0.1 }

    expect(shouldApplyLocalServerCorrection(local, server)).toBe(false)
  })

  it('applies authoritative corrections for rejected horizontal movement', () => {
    const local = { tx: 9.1, ty: 8, tz: 0 }
    const server = { x: 8.49, y: 8, z: 0 }

    expect(localServerDivergence(local, server).dx).toBeGreaterThan(LOCAL_RECONCILE_XY_THRESHOLD)
    expect(shouldApplyLocalServerCorrection(local, server)).toBe(true)
  })

  it('applies authoritative corrections for fall-out recovery sized z divergence', () => {
    const local = { tx: 3, ty: 1, tz: -1.4 }
    const server = { x: 3, y: 1, z: 0 }

    expect(localServerDivergence(local, server).dz).toBeGreaterThan(LOCAL_RECONCILE_Z_THRESHOLD)
    expect(shouldApplyLocalServerCorrection(local, server)).toBe(true)
  })
})

describe('ack-based client prediction reconciliation', () => {
  it('produces NO correction when the server echoes an accepted move (no rubber-band)', () => {
    // Player kept moving locally and is now far ahead of the stale tick,
    // but the server accepted the input it last acked (seq 3) verbatim.
    const pending = [
      { seq: 3, x: 8.3, y: 8, z: 0 },
      { seq: 4, x: 8.6, y: 8, z: 0 },
      { seq: 5, x: 8.9, y: 8, z: 0 }, // current predicted position
    ]
    const server = { x: 8.3, y: 8, z: 0, seq: 3 }

    const r = reconcilePrediction(server, pending)
    expect(r.matched).toBe(true)
    expect(r.apply).toBe(false)
    expect(r.correction).toEqual({ dx: 0, dy: 0, dz: 0 })
  })

  it('produces a correction offset when the server clamped the acked move', () => {
    // Client predicted 9.0 at seq 3, but server clamped it to a wall at 8.49.
    const pending = [
      { seq: 3, x: 9.0, y: 8, z: 0 },
      { seq: 4, x: 9.3, y: 8, z: 0 },
    ]
    const server = { x: 8.49, y: 8, z: 0, seq: 3 }

    const r = reconcilePrediction(server, pending)
    expect(r.matched).toBe(true)
    expect(r.apply).toBe(true)
    expect(r.correction.dx).toBeCloseTo(-0.51, 5)
    expect(r.correction.dy).toBeCloseTo(0, 5)
    expect(r.correction.dz).toBeCloseTo(0, 5)
  })

  it('does not correct when the acked seq is not in the pending buffer', () => {
    const pending = [{ seq: 5, x: 8.9, y: 8, z: 0 }]
    const server = { x: 1, y: 1, z: 0, seq: 3 }

    const r = reconcilePrediction(server, pending)
    expect(r.matched).toBe(false)
    expect(r.apply).toBe(false)
  })

  it('does not correct when the server provides no seq', () => {
    const pending = [{ seq: 1, x: 8, y: 8, z: 0 }]
    const server = { x: 99, y: 99, z: 0 }

    const r = reconcilePrediction(server, pending)
    expect(r.apply).toBe(false)
  })

  it('prunes acknowledged inputs and keeps in-flight ones', () => {
    const pending = [
      { seq: 3, x: 8.3, y: 8, z: 0 },
      { seq: 4, x: 8.6, y: 8, z: 0 },
      { seq: 5, x: 8.9, y: 8, z: 0 },
    ]
    expect(pruneAckedInputs(pending, 4)).toEqual([{ seq: 5, x: 8.9, y: 8, z: 0 }])
    expect(pruneAckedInputs(pending, null)).toEqual(pending)
  })

  it('does not rubber-band across continuous 6 tiles/sec movement with a stale tick', () => {
    // Simulate: at 6 t/s, ~150ms of un-acked travel = ~0.9 tiles ahead of
    // the last acked input. Old threshold logic (0.5) would snap back; the
    // ack-based reconcile must not, because the server accepted what it acked.
    const speedPerTick = 0.3 // tiles per 50ms tick
    const pending = []
    for (let seq = 1; seq <= 6; seq++) {
      pending.push({ seq, x: 8 + seq * speedPerTick, y: 8, z: 0 })
    }
    const ackSeq = 3 // server is 3 ticks behind
    const server = { x: 8 + ackSeq * speedPerTick, y: 8, z: 0, seq: ackSeq }

    const r = reconcilePrediction(server, pending)
    expect(r.apply).toBe(false)
  })
})
