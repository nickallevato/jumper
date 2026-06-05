import { doorsForRoom } from '../../shared/doors.js'
import { getCatalogRoom, registerCatalogRooms, ROOM_CATALOG } from '../../shared/roomCatalog.js'

function roomForClient(room) {
  return {
    ...room,
    portals: room.portals ?? [],
    doors: doorsForRoom(room.id),
  }
}

// Client-facing room registry. The source data lives in shared/roomCatalog.js so
// build tools, server collision, and rendering read one canonical room catalog.
export const ROOMS = Object.fromEntries(
  Object.entries(ROOM_CATALOG).map(([roomId, room]) => [roomId, roomForClient(room)])
)

export function getRoom(roomId) {
  return ROOMS[roomId] ?? roomForClient(getCatalogRoom(roomId))
}

export function registerClientRooms(rooms) {
  const roomIds = registerCatalogRooms(rooms)
  for (const roomId of roomIds) ROOMS[roomId] = roomForClient(getCatalogRoom(roomId))
  return roomIds
}
