export const TICK_MS = 50             // 20 ticks/sec
export const TILE_W = 64
export const TILE_H = 32
export const MAX_POSITION_ABS = 2048
export const MAX_Z_ABS = 64
export const MOVE_SPEED = 6           // tiles per second
export const JUMP_VELOCITY = 0.30     // tiles/tick upward (legacy / item baseline)
export const GRAVITY = 0.022          // tiles/tick² downward
export const ROOM_CAP_SMALL = 6
export const ROOM_CAP_DUNGEON = 50
export const FALL_OUT_RECOVERY_DEPTH = 1.0

export const ROOM_CONTENT_BOUNDS = {
  overworld: {
    minX: 0.51, minY: 0.51, maxX: 62.49, maxY: 46.49, minZ: 0, maxZ: 2.0,
  },
  dungeon_grove: {
    minX: 0.51, minY: 0.51, maxX: 10.49, maxY: 10.49, minZ: 0, maxZ: 1.8,
  },
  dungeon_belltower: {
    minX: 0.51, minY: 0.51, maxX: 4.49, maxY: 4.49, minZ: 0, maxZ: 5.4,
  },
  dungeon_library: {
    minX: 0.51, minY: 0.51, maxX: 8.49, maxY: 8.49, minZ: 0, maxZ: 3.9,
  },
  dungeon_deep: {
    minX: 0.51, minY: 0.51, maxX: 6.49, maxY: 10.49, minZ: 0, maxZ: 2.4,
  },
}

export const ROOM_SPAWNS = {
  overworld: { tx: 8, ty: 8 },
  dungeon_grove: { tx: 8, ty: 8 },
  dungeon_belltower: { tx: 2, ty: 4 },
  dungeon_library: { tx: 5, ty: 8 },
  dungeon_deep: { tx: 3, ty: 1 },
}

const ROOM_WALL_TILES = {
  overworld: new Set([
    '3,2', '4,2', '11,2', '12,2',
    '3,3',
    '3,4',
    '5,6', '6,6', '9,6', '10,6',
    '11,10', '12,10',
    '3,11', '4,11', '11,11',
    '3,12',
  ]),
  dungeon_grove: new Set([
    '8,1', '10,1',
    '8,2', '9,2', '10,2',
  ]),
  dungeon_belltower: new Set(),
  dungeon_library: new Set(),
  dungeon_deep: new Set(),
}

export function contentBoundsForRoom(roomId) {
  return ROOM_CONTENT_BOUNDS[roomId] ?? ROOM_CONTENT_BOUNDS.overworld
}

export function spawnForRoom(roomId) {
  return ROOM_SPAWNS[roomId] ?? ROOM_SPAWNS.overworld
}

export function isFallOutPosition(roomId, { z }) {
  const b = contentBoundsForRoom(roomId)
  return Number.isFinite(z) && z < b.minZ - FALL_OUT_RECOVERY_DEPTH
}

export function fallOutRecoveryPosition(roomId) {
  const spawn = spawnForRoom(roomId)
  const b = contentBoundsForRoom(roomId)
  return { x: spawn.tx, y: spawn.ty, z: b.minZ }
}

export function clampRoomPosition(roomId, { x, y, z }) {
  const b = contentBoundsForRoom(roomId)
  return {
    x: Math.max(b.minX, Math.min(b.maxX, x)),
    y: Math.max(b.minY, Math.min(b.maxY, y)),
    z: Math.max(b.minZ, Math.min(b.maxZ, z)),
  }
}

export function isRoomPositionPassable(roomId, { x, y }, openDoorKeys = new Set()) {
  const b = contentBoundsForRoom(roomId)
  if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) return false
  const key = `${Math.round(x)},${Math.round(y)}`
  return !ROOM_WALL_TILES[roomId]?.has(key) || openDoorKeys.has(key)
}

export function clampAllowedRoomPosition(roomId, current, next, openDoorKeys = new Set()) {
  const clamped = clampRoomPosition(roomId, next)
  const resolved = clampRoomPosition(roomId, current)
  const xStep = { ...resolved, x: clamped.x, z: clamped.z }
  if (isRoomPositionPassable(roomId, xStep, openDoorKeys)) resolved.x = xStep.x
  const yStep = { ...resolved, y: clamped.y, z: clamped.z }
  if (isRoomPositionPassable(roomId, yStep, openDoorKeys)) resolved.y = yStep.y
  resolved.z = clamped.z
  return resolved
}

// --- Movement & feel ---
export const MIN_JUMP_VEL = 0.14            // base jump impulse (tap = short hop)
export const MAX_JUMP_HEIGHT = 1.27         // approx max variable-jump height in tile-z units
export const JUMP_HOLD_GRAV_FACTOR = 0.35   // gravity multiplier while holding on ascent
export const COYOTE_VEL = 0.16              // fixed coyote-jump impulse (no hold bonus)
export const COYOTE_TIME_MS = 120           // grace window after leaving a ledge
export const WALL_SLIDE_GRAV_FACTOR = 0.18  // gravity multiplier while wall-sliding
export const WALL_KICK_SPEED = 1.8          // lateral push per wall kick (tiles)
export const DOUBLE_TAP_MS = 280            // max gap between taps for a wall kick
export const WALL_KICK_COOLDOWN_MS = 400    // lockout before re-entering wall slide
export const BOUNCE_VEL = 0.24              // head-bounce impulse (server-driven)
export const PERFECT_LANDING_MS = 120       // window after landing for a pogo boost
export const POGO_FACTOR = 1.7              // impulse multiplier on a perfect-landing pogo

export const ITEM_EFFECTS = {
  floaty_jump:    { gravity: 0.015 },
  high_jump:      { jumpVelocity: 0.7 },
  reveal_hidden:  { revealHidden: true },
}

export const SOCKET_EVENTS = {
  AUTH:          'auth',
  AUTH_OK:       'auth:ok',
  JOIN_ROOM:     'join:room',
  JOIN_OK:       'join:ok',
  ROOM_DENIED:   'room:denied',
  MOVE:          'move',
  TICK:          'tick',
  ITEM_PICKUP:   'item:pickup',
  ITEM_DROP:     'item:drop',
  ITEM_USE:      'item:use',
  ITEM_STATE:    'item:state',
  DISCOVER:      'discover',
  DISCOVER_OK:   'discover:ok',
  BOUNCE_HEAD:   'bounce:head',
  PUZZLE_STATE:  'puzzle:state',
  DOOR_OPEN:     'door:open',
  EMOTE:         'emote',
  ITEM_HELD:     'item:held',
  WORLD_EVENT:   'world:event',
}
