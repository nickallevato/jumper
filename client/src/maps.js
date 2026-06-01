import { doorsForRoom } from '../../shared/doors.js'
import { ROOM_CONTENT_BOUNDS, ROOM_SPAWNS } from '../../shared/constants.js'

// Room registry. Each room defines its tile grid, elevated platforms, spawn point,
// portals to other rooms, locked doors, and a camera background tint. WorldScene renders
// whichever room it was started with. Tile types: 1=ground, 2=wall, 3=water (walkable, visual).

// The original 16x16 overworld. The live overworld grows from this base — see below.
const OVERWORLD_BASE = [
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

// --- Overworld growth -------------------------------------------------------
// The world grows one band (GROW_BAND wide) per loop iteration, alternating append
// directions. Append-only keeps every existing tile coordinate valid — platforms,
// portals, secret zones, and the puzzle all stay put. Each dimension caps at GROW_MAX.
// To grow the world: append the next direction to OVERWORLD_GROWTH (alternate
// 'east'/'south'). The grid is rebuilt from OVERWORLD_BASE through this log.
const GROW_BAND = 16
const GROW_MAX = 64

function expandEast(grid) {
  return grid.map((row, y) => {
    const border = (y === 0 || y === grid.length - 1)
    const inner = row.slice(0, -1)                                  // drop east wall
    const band = Array.from({ length: GROW_BAND }, () => (border ? 2 : 1))
    return [...inner, ...band, 2]                                   // re-add east wall
  })
}

function expandSouth(grid) {
  const W = grid[0].length
  const top = grid.slice(0, -1)                                     // drop bottom wall
  const band = Array.from({ length: GROW_BAND }, () =>
    Array.from({ length: W }, (_, x) => (x === 0 || x === W - 1 ? 2 : 1)))
  const bottom = Array.from({ length: W }, () => 2)
  return [...top, ...band, bottom]
}

// Applied growth, oldest first. The loop appends the next direction each iteration.
const OVERWORLD_GROWTH = ['east', 'south', 'east', 'south', 'east']

function buildOverworld() {
  let g = OVERWORLD_BASE
  for (const dir of OVERWORLD_GROWTH) {
    if (dir === 'east' && g[0].length < GROW_MAX) g = expandEast(g)
    else if (dir === 'south' && g.length < GROW_MAX) g = expandSouth(g)
  }
  return g
}

const OVERWORLD_GRID = buildOverworld()

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

// The Sunken Library — a dark archive. Visible book-stacks climb partway; the final
// shelves are hidden and only appear (and become solid) while holding the Lantern.
const LIBRARY_GRID = [
  [2,2,2,2,2,2,2,2,2,2],
  [2,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,2],
  [2,2,2,2,2,2,2,2,2,2],
]

const LIBRARY_PLATFORMS = [
  { tx: 2, ty: 2, tz: 0.9 },   // visible book-stacks
  { tx: 2, ty: 3, tz: 1.8 },
  { tx: 2, ty: 4, tz: 2.7 },
]

// The Undercroft — a compact deep-room audit map. The route trends down-screen through
// staggered ledges while authored tz values stay non-negative for the current physics.
const DEEP_GRID = [
  [2,2,2,2,2,2,2,2],
  [2,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,2],
  [2,2,2,2,2,2,2,2],
]

const DEEP_PLATFORMS = [
  { tx: 3, ty: 3, tz: 0.6 },
  { tx: 4, ty: 5, tz: 1.2 },
  { tx: 2, ty: 7, tz: 0.8 },
  { tx: 4, ty: 8, tz: 1.8 },
  { tx: 4, ty: 10, tz: 2.4 },
]

export const ROOMS = {
  overworld: {
    grid: OVERWORLD_GRID,
    contentBounds: ROOM_CONTENT_BOUNDS.overworld,
    platforms: OVERWORLD_PLATFORMS,
    spawn: ROOM_SPAWNS.overworld,
    bg: '#1a1a2e',
    portals: [
      { tx: 13, ty: 13, to: 'dungeon_grove' },
      { tx: 13, ty: 2, to: 'dungeon_belltower' },
      { tx: 2, ty: 7, to: 'dungeon_library' },
    ],
    doors: doorsForRoom('overworld'),
    follow: true,   // the overworld grows beyond one screen — camera follows the player
  },
  dungeon_grove: {
    grid: GROVE_GRID,
    contentBounds: ROOM_CONTENT_BOUNDS.dungeon_grove,
    platforms: GROVE_PLATFORMS,
    spawn: ROOM_SPAWNS.dungeon_grove,
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
    contentBounds: ROOM_CONTENT_BOUNDS.dungeon_belltower,
    platforms: BELLTOWER_PLATFORMS,
    spawn: ROOM_SPAWNS.dungeon_belltower,
    bg: '#13111c',
    portals: [{ tx: 4, ty: 4, to: 'overworld' }],
    follow: true,                              // tall room — camera follows the player
    bell: { tx: 3, ty: 1, tz: 5.4, reachZ: 5.0 },
  },
  dungeon_library: {
    grid: LIBRARY_GRID,
    contentBounds: ROOM_CONTENT_BOUNDS.dungeon_library,
    platforms: LIBRARY_PLATFORMS,
    spawn: ROOM_SPAWNS.dungeon_library,
    bg: '#0a0a14',
    portals: [{ tx: 1, ty: 1, to: 'overworld' }],
    follow: true,
    // Hidden shelves bridge from the top book-stack to the archive ledge — Lantern only.
    hidden: [
      { tx: 3, ty: 4, tz: 3.3 },
      { tx: 4, ty: 4, tz: 3.9 },
      { tx: 5, ty: 4, tz: 3.9 },   // archive ledge → secret_archivist (move here w/ Lantern)
    ],
  },
  dungeon_deep: {
    grid: DEEP_GRID,
    contentBounds: ROOM_CONTENT_BOUNDS.dungeon_deep,
    platforms: DEEP_PLATFORMS,
    spawn: ROOM_SPAWNS.dungeon_deep,
    bg: '#080911',
    portals: [{ tx: 4, ty: 1, to: 'overworld' }],
    follow: true,
  },
}

export function getRoom(roomId) {
  return ROOMS[roomId] ?? ROOMS.overworld
}
