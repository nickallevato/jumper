import { describe, expect, it } from 'vitest'
import { groundHeightAt, canStepTo, WALK_STEP_TOLERANCE } from '../client/src/terrain.js'

const PLATFORMS = [
  { tx: 5, ty: 5, tz: 1 },
  { tx: 6, ty: 5, tz: 1 },
  { tx: 6, ty: 5, tz: 1.5 }, // duplicate tile, taller — should win
  { tx: 7, ty: 5, tz: 0.75 },
]

describe('groundHeightAt', () => {
  it('is 0 on a tile with no platform (plain ground)', () => {
    expect(groundHeightAt(PLATFORMS, 0, 0)).toBe(0)
  })

  it('returns the platform height for a raised tile', () => {
    expect(groundHeightAt(PLATFORMS, 5, 5)).toBe(1)
  })

  it('returns the tallest platform when several stack on one tile', () => {
    expect(groundHeightAt(PLATFORMS, 6, 5)).toBe(1.5)
  })

  it('rounds fractional positions to the tile the player stands on', () => {
    expect(groundHeightAt(PLATFORMS, 5.4, 4.8)).toBe(1) // rounds to (5,5)
  })
})

describe('canStepTo (horizontal walk gating while grounded)', () => {
  it('allows walking across same-height ground', () => {
    expect(canStepTo(PLATFORMS, 5, 5, 1)).toBe(true)   // tz 1 -> tile height 1
  })

  it('blocks walking UP onto a higher surface (must jump)', () => {
    // standing on ground (z=0), stepping onto a 0.75 cliff tile
    expect(canStepTo(PLATFORMS, 7, 5, 0)).toBe(false)
    // standing on a 1.0 ledge, stepping onto a 1.5 ledge
    expect(canStepTo(PLATFORMS, 6, 5, 1)).toBe(false)
  })

  it('allows walking onto a LOWER surface (you will then fall)', () => {
    // standing on a 1.5 ledge, stepping onto plain ground
    expect(canStepTo(PLATFORMS, 0, 0, 1.5)).toBe(true)
  })

  it('tolerates tiny float error at equal height', () => {
    expect(canStepTo(PLATFORMS, 5, 5, 1 - WALK_STEP_TOLERANCE / 2)).toBe(true)
  })
})
