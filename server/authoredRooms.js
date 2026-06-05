import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  cloneRoomCatalog,
  exportRoomCatalogSnapshot,
  ROOM_CATALOG,
  ROOM_CATALOG_SCHEMA_VERSION,
  registerCatalogRooms,
  validateRoomCatalog,
} from '../shared/roomCatalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_AUTHORED_ROOMS_PATH = join(__dirname, '../data/authored-rooms.json')

export function loadAuthoredRooms(path = process.env.ROOM_CATALOG_PATH || DEFAULT_AUTHORED_ROOMS_PATH) {
  if (!existsSync(path)) return { path, roomIds: [] }

  const snapshot = JSON.parse(readFileSync(path, 'utf8'))
  if (snapshot.schemaVersion !== ROOM_CATALOG_SCHEMA_VERSION) {
    throw new Error(`Room catalog schema ${snapshot.schemaVersion} is not supported`)
  }
  if (!snapshot.rooms || typeof snapshot.rooms !== 'object' || Array.isArray(snapshot.rooms)) {
    throw new Error('Room catalog import requires a rooms object')
  }
  const rooms = cloneRoomCatalog(snapshot.rooms)
  const errors = validateRoomCatalog({ ...ROOM_CATALOG, ...rooms })
  if (errors.length > 0) {
    throw new Error(`Room catalog import is invalid:\n${errors.join('\n')}`)
  }
  const roomIds = registerCatalogRooms(rooms)
  return { path, roomIds }
}

export function roomCatalogResponse() {
  return exportRoomCatalogSnapshot()
}
