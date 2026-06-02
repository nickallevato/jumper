import { describe, expect, it } from 'vitest'
import {
  clampAllowedRoomPosition,
  isRoomPositionPassable,
} from '../shared/constants.js'
import { COUNTERWEIGHT } from '../shared/puzzles.js'
import { canStepTo, groundHeightAt } from '../client/src/terrain.js'

describe('collision tile footprint convention', () => {
  it('uses centered round footprints for wall collision edges', () => {
    expect(isRoomPositionPassable('overworld', { x: 2.49, y: 2 })).toBe(true)
    expect(isRoomPositionPassable('overworld', { x: 2.5, y: 2 })).toBe(false)
    expect(isRoomPositionPassable('overworld', { x: 3.49, y: 2 })).toBe(false)
    expect(isRoomPositionPassable('overworld', { x: 3.5, y: 2 })).toBe(false)
  })

  it('clamps by axis against rounded wall footprints without sliding into the wall tile', () => {
    const current = { x: 2.49, y: 2, z: 0 }

    expect(clampAllowedRoomPosition('overworld', current, { x: 2.5, y: 2, z: 0 }))
      .toEqual(current)

    expect(clampAllowedRoomPosition('overworld', current, { x: 2.49, y: 1.6, z: 0 }))
      .toEqual({ x: 2.49, y: 1.6, z: 0 })
  })

  it('uses the same rounded footprint for landing and grounded platform step gating', () => {
    const platforms = [
      { tx: 7, ty: 5, tz: 0.75 },
      { tx: 8, ty: 5, tz: 1 },
    ]

    expect(groundHeightAt(platforms, 6.49, 5)).toBe(0)
    expect(groundHeightAt(platforms, 6.5, 5)).toBe(0.75)
    expect(canStepTo(platforms, 6.5, 5, 0)).toBe(false)
    expect(canStepTo(platforms, 8.49, 5, 1)).toBe(true)
    expect(canStepTo(platforms, 8.5, 5, 1)).toBe(true)
  })

  it('treats the counterweight riser as a mutable platform surface at its rounded tile', () => {
    const { tx, ty, loweredZ, raisedZ } = COUNTERWEIGHT.riser
    const lowered = [{ tx, ty, tz: loweredZ }]
    const raised = [{ tx, ty, tz: raisedZ }]

    expect(groundHeightAt(lowered, tx + 0.49, ty)).toBe(loweredZ)
    expect(groundHeightAt(raised, tx + 0.49, ty)).toBe(raisedZ)
    expect(canStepTo(raised, tx + 0.49, ty, loweredZ)).toBe(false)
    expect(canStepTo(raised, tx + 0.49, ty, raisedZ)).toBe(true)
  })
})
