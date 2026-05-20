// Locked doors, keyed by room. A door tile starts as a wall (closed) and becomes passable
// when a player uses a Key (item world_trigger 'unlock_door') next to it. Shared so the
// server can validate proximity and the client can render + open them. Positions must match
// wall tiles carved into the room grids in client/src/maps.js.
export const DOORS = {
  dungeon_grove: [{ tx: 9, ty: 2 }], // seals the corner vault (interior at 9,1)
}

export const DOOR_USE_RADIUS = 1.3

export function doorsForRoom(roomId) {
  return DOORS[roomId] ?? []
}

export function findDoorNear(roomId, x, y) {
  return doorsForRoom(roomId).find(d => Math.hypot(d.tx - x, d.ty - y) < DOOR_USE_RADIUS) ?? null
}
