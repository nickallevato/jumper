import { describe, it, expect } from 'vitest'
import { COUNTERWEIGHT, isOnPlate, isAtGoal } from '../shared/puzzles.js'

describe('counterweight geometry', () => {
  const { plate, goal, riser } = COUNTERWEIGHT

  it('detects a player standing on the plate', () => {
    expect(isOnPlate(plate.tx, plate.ty)).toBe(true)
    expect(isOnPlate(plate.tx + 0.4, plate.ty - 0.3)).toBe(true)
  })

  it('ignores positions away from the plate', () => {
    expect(isOnPlate(plate.tx + 2, plate.ty)).toBe(false)
    expect(isOnPlate(0, 0)).toBe(false)
  })

  it('counts the goal as reached only at sufficient height', () => {
    expect(isAtGoal(goal.tx, goal.ty, goal.tz)).toBe(true)
    expect(isAtGoal(goal.tx, goal.ty, goal.reachZ)).toBe(true)
    expect(isAtGoal(goal.tx, goal.ty, goal.reachZ - 0.1)).toBe(false)
  })

  it('does not reach the goal from a far tile even when high', () => {
    expect(isAtGoal(goal.tx + 2, goal.ty, goal.tz)).toBe(false)
  })

  it('goal is unreachable from the ground but reachable off the raised riser', () => {
    const MAX_JUMP = 1.27 // approx max variable-jump height (see movement spec)
    expect(riser.loweredZ + MAX_JUMP).toBeLessThan(goal.tz)      // not from ground
    expect(riser.raisedZ + MAX_JUMP).toBeGreaterThanOrEqual(goal.reachZ) // yes from riser
  })
})
