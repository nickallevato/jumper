import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { loadAuthoredRooms } from '../server/authoredRooms.js'
import { getCatalogRoom, ROOM_CATALOG_SCHEMA_VERSION } from '../shared/roomCatalog.js'
import { spawnForRoom } from '../shared/constants.js'

describe('authored room loading', () => {
  it('loads partial snapshots that reference built-in catalog rooms', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jumper-authored-rooms-'))
    const path = join(dir, 'authored-rooms.json')
    const room = {
      id: 'server_loaded_room',
      name: 'Server Loaded Room',
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
    writeFileSync(path, `${JSON.stringify({ schemaVersion: ROOM_CATALOG_SCHEMA_VERSION, rooms: { [room.id]: room } })}\n`)

    expect(loadAuthoredRooms(path).roomIds).toEqual([room.id])
    expect(getCatalogRoom(room.id)).toEqual(room)
    expect(spawnForRoom(room.id)).toEqual(room.spawn)
  })
})
