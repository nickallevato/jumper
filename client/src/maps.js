import { doorsForRoom } from '../../shared/doors.js'

// Room registry. Each room defines its tile grid, elevated platforms, spawn point,
// portals to other rooms, locked doors, and a camera background tint. WorldScene renders
// whichever room it was started with. Tile types: 1=ground, 2=wall, 3=water (walkable, visual).

const OVERWORLD_GRID = [
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,2,2,1,1,1,1,1,1,2,2,1,1,2],
  [2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,2,2,1,1,2,2,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,2,2,1,1,2],
  [2,1,1,2,2,1,1,1,1,1,1,2,1,1,1,2],
  [2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
]

const OVERWORLD_PLATFORMS = [
  { tx: 7, ty: 5, tz: 1 },
  { tx: 8, ty: 5, tz: 1 },
  { tx: 7, ty: 4, tz: 1.5 },
  { tx: 7, ty: 9, tz: 1 },
  { tx: 8, ty: 9, tz: 1 },
  { tx: 12, ty: 3, tz: 1 },
  { tx: 13, ty: 3, tz: 1 },
  { tx: 12, ty: 4, tz: 1 },
  { tx: 2, ty: 11, tz: 0.75 },
  { tx: 2, ty: 12, tz: 0.75 },
]

// The Grove — an ungated starter dungeon: a sunken pool with stepping platforms,
// and a sealed corner vault (interior 9,1) behind a locked door at (9,2).
const GROVE_GRID = [
  [2,2,2,2,2,2,2,2,2,2,2,2],
  [2,1,1,1,1,1,1,1,2,1,2,2],  // vault interior at col 9, walls at 8/10
  [2,1,1,1,1,1,1,1,2,2,2,2],  // door tile at (9,2) — closed = wall
  [2,1,1,1,3,3,3,3,1,1,1,2],
  [2,1,1,3,3,3,3,3,3,1,1,2],
  [2,1,1,3,3,3,3,3,3,1,1,2],
  [2,1,1,3,3,3,3,3,3,1,1,2],
  [2,1,1,1,3,3,3,3,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,2],
  [2,2,2,2,2,2,2,2,2,2,2,2],
]

// Stepping stones across the pool, rising toward a small island.
const GROVE_PLATFORMS = [
  { tx: 4, ty: 4, tz: 0.5 },
  { tx: 5, ty: 5, tz: 1.0 },
  { tx: 6, ty: 5, tz: 1.5 },
  { tx: 6, ty: 6, tz: 1.0 },
  { tx: 7, ty: 6, tz: 0.5 },
]

// The Belltower — a tall narrow shaft. Ledges spiral up the walls (wall-kick shortcuts
// possible); a normal-jump climb (each step +0.9 tz) reaches the bell at the top.
const BELLTOWER_GRID = [
  [2,2,2,2,2,2],
  [2,1,1,1,1,2],
  [2,1,1,1,1,2],
  [2,1,1,1,1,2],
  [2,1,1,1,1,2],
  [2,2,2,2,2,2],
]

const BELLTOWER_PLATFORMS = [
  { tx: 1, ty: 4, tz: 0.9 },
  { tx: 1, ty: 3, tz: 1.8 },
  { tx: 1, ty: 2, tz: 2.7 },
  { tx: 1, ty: 1, tz: 3.6 },
  { tx: 2, ty: 1, tz: 4.5 },
  { tx: 3, ty: 1, tz: 5.4 },  // bell platform
]

export const ROOMS = {
  overworld: {
    grid: OVERWORLD_GRID,
    platforms: OVERWORLD_PLATFORMS,
    spawn: { tx: 8, ty: 8 },
    bg: '#1a1a2e',
    portals: [
      { tx: 13, ty: 13, to: 'dungeon_grove' },
      { tx: 13, ty: 2, to: 'dungeon_belltower' },
    ],
    doors: doorsForRoom('overworld'),
  },
  dungeon_grove: {
    grid: GROVE_GRID,
    platforms: GROVE_PLATFORMS,
    spawn: { tx: 8, ty: 8 },
    bg: '#0c1422',
    portals: [{ tx: 2, ty: 2, to: 'overworld' }],
    doors: doorsForRoom('dungeon_grove'),
    // Hidden stepping stones across the pool — only visible/solid while holding the Lantern.
    hidden: [
      { tx: 4, ty: 4, tz: 0.6 },
      { tx: 5, ty: 5, tz: 1.0 },
      { tx: 6, ty: 6, tz: 1.4 },
      { tx: 7, ty: 6, tz: 1.8 },  // goal ledge → secret_illuminated
    ],
  },
  dungeon_belltower: {
    grid: BELLTOWER_GRID,
    platforms: BELLTOWER_PLATFORMS,
    spawn: { tx: 2, ty: 4 },
    bg: '#13111c',
    portals: [{ tx: 4, ty: 4, to: 'overworld' }],
    follow: true,                              // tall room — camera follows the player
    bell: { tx: 3, ty: 1, tz: 5.4, reachZ: 5.0 },
  },
}

export function getRoom(roomId) {
  return ROOMS[roomId] ?? ROOMS.overworld
}
