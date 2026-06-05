import { registerClientRooms } from './maps.js'
import { importRoomCatalogSnapshot, ROOM_CATALOG } from '../../shared/roomCatalog.js'

export const DEFAULT_ROOM_ID = 'overworld'

export async function loadRuntimeRoomCatalog(fetchImpl = fetch) {
  const res = await fetchImpl('/api/rooms/catalog')
  if (!res.ok) throw new Error(`Room catalog failed: ${res.status}`)
  const rooms = importRoomCatalogSnapshot(await res.json(), ROOM_CATALOG)
  return registerClientRooms(rooms)
}

export function roomIdFromLocation(location = globalThis.location) {
  const raw = new URLSearchParams(location?.search ?? '').get('room')
  return raw?.trim() || DEFAULT_ROOM_ID
}
