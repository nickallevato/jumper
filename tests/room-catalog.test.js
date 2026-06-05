import { describe, expect, it } from 'vitest'
import { ROOMS } from '../client/src/maps.js'
import {
  ROOM_CONTENT_BOUNDS,
  ROOM_PORTALS,
  ROOM_SPAWNS,
  isRoomPositionPassable,
} from '../shared/constants.js'
import {
  ROOM_CATALOG,
  validateRoomCatalog,
} from '../shared/roomCatalog.js'

describe('room catalog', () => {
  it('validates the canonical room catalog', () => {
    expect(validateRoomCatalog()).toEqual([])
  })

  it('keeps client rooms and server constants derived from the same catalog', () => {
    expect(Object.keys(ROOMS)).toEqual(Object.keys(ROOM_CATALOG))

    for (const [roomId, room] of Object.entries(ROOM_CATALOG)) {
      expect(ROOMS[roomId].grid).toBe(room.grid)
      expect(ROOMS[roomId].platforms).toBe(room.platforms)
      expect(ROOMS[roomId].spawn).toBe(room.spawn)
      expect(ROOMS[roomId].portals).toBe(room.portals ?? [])
      expect(ROOM_CONTENT_BOUNDS[roomId]).toBe(room.contentBounds)
      expect(ROOM_SPAWNS[roomId]).toBe(room.spawn)
      expect(ROOM_PORTALS[roomId]).toBe(room.portals ?? [])
    }
  })

  it('uses catalog wall tiles for authoritative collision', () => {
    for (const [roomId, room] of Object.entries(ROOM_CATALOG)) {
      for (const [tx, ty] of room.wallTiles ?? []) {
        expect(isRoomPositionPassable(roomId, { x: tx, y: ty }), `${roomId} ${tx},${ty}`).toBe(false)
      }
    }

    expect(isRoomPositionPassable('dungeon_grove', { x: 9, y: 2 }, new Set(['9,2']))).toBe(true)
  })
})
