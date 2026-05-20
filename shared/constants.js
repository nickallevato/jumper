export const TICK_MS = 50             // 20 ticks/sec
export const TILE_W = 64
export const TILE_H = 32
export const MOVE_SPEED = 6           // tiles per second
export const JUMP_VELOCITY = 0.30     // tiles/tick upward (legacy / item baseline)
export const GRAVITY = 0.022          // tiles/tick² downward
export const ROOM_CAP_SMALL = 6
export const ROOM_CAP_DUNGEON = 50

// --- Movement & feel ---
export const MIN_JUMP_VEL = 0.14            // base jump impulse (tap = short hop)
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
}
