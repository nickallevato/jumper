import { describe, it, expect } from 'vitest'
import { doorsForRoom, findDoorNear } from '../shared/doors.js'

describe('doors', () => {
  it('lists doors for a room and none for unknown rooms', () => {
    expect(doorsForRoom('dungeon_grove')).toEqual([{ tx: 9, ty: 2 }])
    expect(doorsForRoom('overworld')).toEqual([])
    expect(doorsForRoom('nowhere')).toEqual([])
  })

  it('finds a door within use radius and ignores far/foreign positions', () => {
    expect(findDoorNear('dungeon_grove', 9, 3)).toEqual({ tx: 9, ty: 2 })   // 1 tile away
    expect(findDoorNear('dungeon_grove', 9, 5)).toBeNull()                  // too far
    expect(findDoorNear('overworld', 9, 2)).toBeNull()                      // wrong room
  })
})
