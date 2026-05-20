export const TICK_MS = 50             // 20 ticks/sec
export const TILE_W = 64
export const TILE_H = 32
export const MOVE_SPEED = 6           // tiles per second
export const JUMP_VELOCITY = 0.30     // tiles/tick upward
export const GRAVITY = 0.022          // tiles/tick² downward
export const ROOM_CAP_SMALL = 6
export const ROOM_CAP_DUNGEON = 50

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
}
