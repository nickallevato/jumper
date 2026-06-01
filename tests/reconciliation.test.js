import { describe, expect, it } from 'vitest'
import {
  LOCAL_RECONCILE_XY_THRESHOLD,
  LOCAL_RECONCILE_Z_THRESHOLD,
  localServerDivergence,
  shouldApplyLocalServerCorrection,
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
