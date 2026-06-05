import { describe, expect, it } from 'vitest'
import { ROOMS } from '../client/src/maps.js'
import {
  ROOM_CONTENT_BOUNDS,
  ROOM_PORTALS,
  ROOM_SPAWNS,
  contentBoundsForRoom,
  findPortal,
  isRoomPositionPassable,
  spawnForRoom,
} from '../shared/constants.js'
import {
  ROOM_CATALOG,
  exportRoomCatalogSnapshot,
  formatRoomCatalogSnapshot,
  importRoomCatalogSnapshot,
  validateRoomCatalog,
} from '../shared/roomCatalog.js'
import { registerClientRooms } from '../client/src/maps.js'
import { loadRuntimeRoomCatalog, roomIdFromLocation } from '../client/src/roomLaunch.js'

describe('room catalog', () => {
  it('validates the canonical room catalog', () => {
    expect(validateRoomCatalog()).toEqual([])
  })

  it('round-trips the room editor catalog import/export shape', () => {
    const snapshot = exportRoomCatalogSnapshot(ROOM_CATALOG)
    const imported = importRoomCatalogSnapshot(JSON.parse(formatRoomCatalogSnapshot(snapshot)))

    expect(imported).toEqual(ROOM_CATALOG)
    expect(imported).not.toBe(ROOM_CATALOG)
    expect(imported.overworld.grid).not.toBe(ROOM_CATALOG.overworld.grid)
  })

  it('rejects invalid room editor imports before they reach runtime adapters', () => {
    const snapshot = exportRoomCatalogSnapshot(ROOM_CATALOG)
    snapshot.rooms.overworld.portals[0].to = 'missing_room'

    expect(() => importRoomCatalogSnapshot(snapshot)).toThrow('portal target missing_room is missing')
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

  it('registers authored catalog rooms for client launch and server authority', () => {
    const authoredRoom = {
      id: 'authored_playtest_room',
      name: 'Authored Playtest Room',
      grid: [
        [2, 2, 2, 2, 2],
        [2, 1, 1, 1, 2],
        [2, 1, 2, 1, 2],
        [2, 1, 1, 1, 2],
        [2, 2, 2, 2, 2],
      ],
      contentBounds: { minX: 0.51, minY: 0.51, maxX: 3.49, maxY: 3.49, minZ: 0, maxZ: 1 },
      platforms: [{ tx: 3, ty: 3, tz: 1 }],
      spawn: { tx: 1, ty: 3 },
      bg: '#10232b',
      portals: [{ tx: 3, ty: 1, to: 'overworld', landing: { tx: 8, ty: 8 } }],
      wallTiles: [[2, 2]],
    }

    expect(registerClientRooms({ [authoredRoom.id]: authoredRoom })).toEqual([authoredRoom.id])
    expect(ROOMS[authoredRoom.id].grid).toBe(authoredRoom.grid)
    expect(roomIdFromLocation({ search: '?room=authored_playtest_room' })).toBe(authoredRoom.id)
    expect(spawnForRoom(authoredRoom.id)).toBe(authoredRoom.spawn)
    expect(contentBoundsForRoom(authoredRoom.id)).toBe(authoredRoom.contentBounds)
    expect(findPortal(authoredRoom.id, { tx: 3, ty: 1, to: 'overworld' })).toBe(authoredRoom.portals[0])
    expect(isRoomPositionPassable(authoredRoom.id, { x: 2, y: 2 })).toBe(false)
  })

  it('loads runtime room catalog snapshots before launch', async () => {
    const room = {
      id: 'runtime_loader_room',
      name: 'Runtime Loader Room',
      grid: [
        [2, 2, 2],
        [2, 1, 2],
        [2, 2, 2],
      ],
      contentBounds: { minX: 0.51, minY: 0.51, maxX: 1.49, maxY: 1.49, minZ: 0, maxZ: 1 },
      platforms: [],
      spawn: { tx: 1, ty: 1 },
      bg: '#10232b',
      portals: [{ tx: 1, ty: 1, to: 'overworld', landing: { tx: 8, ty: 8 } }],
      wallTiles: [],
    }
    const fetchCatalog = async (url) => ({
      ok: url === '/api/rooms/catalog',
      json: async () => exportRoomCatalogSnapshot({ [room.id]: room }),
    })

    await expect(loadRuntimeRoomCatalog(fetchCatalog)).resolves.toEqual([room.id])
    expect(ROOMS[room.id].spawn).toEqual(room.spawn)
  })
})
