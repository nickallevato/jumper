// Canonical room catalog for Jumper runtime and build tools.
// Tile types: 1=ground, 2=wall, 3=water (walkable, visual).

export const ROOM_TILE_TYPES = Object.freeze({
  ground: 1,
  wall: 2,
  water: 3,
})

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

const GROW_BAND = 16
const GROW_MAX = 64

function expandEast(grid) {
  return grid.map((row, y) => {
    const border = (y === 0 || y === grid.length - 1)
    const inner = row.slice(0, -1)
    const band = Array.from({ length: GROW_BAND }, () => (border ? 2 : 1))
    return [...inner, ...band, 2]
  })
}

function expandSouth(grid) {
  const W = grid[0].length
  const top = grid.slice(0, -1)
  const band = Array.from({ length: GROW_BAND }, () =>
    Array.from({ length: W }, (_, x) => (x === 0 || x === W - 1 ? 2 : 1)))
  const bottom = Array.from({ length: W }, () => 2)
  return [...top, ...band, bottom]
}

const OVERWORLD_GROWTH = ['east', 'south', 'east', 'south', 'east']

function buildOverworld() {
  let g = OVERWORLD_BASE
  for (const dir of OVERWORLD_GROWTH) {
    if (dir === 'east' && g[0].length < GROW_MAX) g = expandEast(g)
    else if (dir === 'south' && g.length < GROW_MAX) g = expandSouth(g)
  }
  return g
}

export const ROOM_CATALOG_SCHEMA_VERSION = 1

export const ROOM_CATALOG = {
  overworld: {
    id: 'overworld',
    name: 'Overworld',
    grid: buildOverworld(),
    contentBounds: {
      minX: 0.51, minY: 0.51, maxX: 62.49, maxY: 46.49, minZ: 0, maxZ: 2.0,
    },
    platforms: [
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
    ],
    spawn: { tx: 8, ty: 8 },
    bg: '#1a1a2e',
    portals: [
      { tx: 13, ty: 13, to: 'dungeon_grove', landing: { tx: 2, ty: 3 } },
      { tx: 13, ty: 2, to: 'dungeon_belltower', landing: { tx: 4, ty: 3 } },
      { tx: 2, ty: 7, to: 'dungeon_library', landing: { tx: 2, ty: 1 } },
    ],
    wallTiles: [
      [3, 2], [4, 2], [11, 2], [12, 2],
      [3, 3],
      [3, 4],
      [5, 6], [6, 6], [9, 6], [10, 6],
      [11, 10], [12, 10],
      [3, 11], [4, 11], [11, 11],
      [3, 12],
    ],
    follow: true,
  },
  dungeon_grove: {
    id: 'dungeon_grove',
    name: 'The Grove',
    grid: [
      [2,2,2,2,2,2,2,2,2,2,2,2],
      [2,1,1,1,1,1,1,1,2,1,2,2],
      [2,1,1,1,1,1,1,1,2,2,2,2],
      [2,1,1,1,3,3,3,3,1,1,1,2],
      [2,1,1,3,3,3,3,3,3,1,1,2],
      [2,1,1,3,3,3,3,3,3,1,1,2],
      [2,1,1,3,3,3,3,3,3,1,1,2],
      [2,1,1,1,3,3,3,3,1,1,1,2],
      [2,1,1,1,1,1,1,1,1,1,1,2],
      [2,1,1,1,1,1,1,1,1,1,1,2],
      [2,1,1,1,1,1,1,1,1,1,1,2],
      [2,2,2,2,2,2,2,2,2,2,2,2],
    ],
    contentBounds: {
      minX: 0.51, minY: 0.51, maxX: 10.49, maxY: 10.49, minZ: 0, maxZ: 1.8,
    },
    platforms: [
      { tx: 4, ty: 4, tz: 0.5 },
      { tx: 5, ty: 5, tz: 1.0 },
      { tx: 6, ty: 5, tz: 1.5 },
      { tx: 6, ty: 6, tz: 1.0 },
      { tx: 7, ty: 6, tz: 0.5 },
    ],
    spawn: { tx: 8, ty: 8 },
    bg: '#0c1422',
    portals: [
      { tx: 2, ty: 2, to: 'overworld', landing: { tx: 13, ty: 14 } },
    ],
    wallTiles: [
      [8, 1], [10, 1],
      [8, 2], [9, 2], [10, 2],
    ],
    hidden: [
      { tx: 4, ty: 4, tz: 0.6 },
      { tx: 5, ty: 5, tz: 1.0 },
      { tx: 6, ty: 6, tz: 1.4 },
      { tx: 7, ty: 6, tz: 1.8 },
    ],
  },
  dungeon_belltower: {
    id: 'dungeon_belltower',
    name: 'The Belltower',
    grid: [
      [2,2,2,2,2,2],
      [2,1,1,1,1,2],
      [2,1,1,1,1,2],
      [2,1,1,1,1,2],
      [2,1,1,1,1,2],
      [2,2,2,2,2,2],
    ],
    contentBounds: {
      minX: 0.51, minY: 0.51, maxX: 4.49, maxY: 4.49, minZ: 0, maxZ: 5.4,
    },
    platforms: [
      { tx: 1, ty: 4, tz: 0.9 },
      { tx: 1, ty: 3, tz: 1.8 },
      { tx: 1, ty: 2, tz: 2.7 },
      { tx: 1, ty: 1, tz: 3.6 },
      { tx: 2, ty: 1, tz: 4.5 },
      { tx: 3, ty: 1, tz: 5.4 },
    ],
    spawn: { tx: 2, ty: 4 },
    bg: '#13111c',
    portals: [
      { tx: 4, ty: 4, to: 'overworld', landing: { tx: 14, ty: 2 } },
    ],
    wallTiles: [],
    follow: true,
    bell: { tx: 3, ty: 1, tz: 5.4, reachZ: 5.0 },
  },
  dungeon_library: {
    id: 'dungeon_library',
    name: 'The Sunken Library',
    grid: [
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
    ],
    contentBounds: {
      minX: 0.51, minY: 0.51, maxX: 8.49, maxY: 8.49, minZ: 0, maxZ: 3.9,
    },
    platforms: [
      { tx: 2, ty: 2, tz: 0.9 },
      { tx: 2, ty: 3, tz: 1.8 },
      { tx: 2, ty: 4, tz: 2.7 },
    ],
    spawn: { tx: 5, ty: 8 },
    bg: '#0a0a14',
    portals: [
      { tx: 1, ty: 1, to: 'overworld', landing: { tx: 3, ty: 7 } },
    ],
    wallTiles: [],
    follow: true,
    hidden: [
      { tx: 3, ty: 4, tz: 3.3 },
      { tx: 4, ty: 4, tz: 3.9 },
      { tx: 5, ty: 4, tz: 3.9 },
    ],
  },
  dungeon_deep: {
    id: 'dungeon_deep',
    name: 'The Undercroft',
    grid: [
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
    ],
    contentBounds: {
      minX: 0.51, minY: 0.51, maxX: 6.49, maxY: 10.49, minZ: 0, maxZ: 2.4,
    },
    platforms: [
      { tx: 3, ty: 3, tz: 0.6 },
      { tx: 4, ty: 5, tz: 1.2 },
      { tx: 2, ty: 7, tz: 0.8 },
      { tx: 4, ty: 8, tz: 1.8 },
      { tx: 4, ty: 10, tz: 2.4 },
    ],
    spawn: { tx: 3, ty: 1 },
    bg: '#080911',
    portals: [
      { tx: 4, ty: 1, to: 'overworld', landing: { tx: 4, ty: 3 } },
    ],
    wallTiles: [],
    follow: true,
  },
}

export function getCatalogRoom(roomId) {
  return ROOM_CATALOG[roomId] ?? ROOM_CATALOG.overworld
}

export function roomWallTileKeys(room) {
  return new Set((room.wallTiles ?? []).map(([tx, ty]) => `${tx},${ty}`))
}

export function validateRoomCatalog(catalog = ROOM_CATALOG) {
  const errors = []
  for (const [roomId, room] of Object.entries(catalog)) {
    if (room.id !== roomId) errors.push(`${roomId}: id must match catalog key`)
    if (!Array.isArray(room.grid) || room.grid.length === 0) {
      errors.push(`${roomId}: grid must have rows`)
      continue
    }
    const width = room.grid[0]?.length
    if (!Number.isInteger(width) || width <= 0) errors.push(`${roomId}: grid must have columns`)
    for (const [rowIndex, row] of room.grid.entries()) {
      if (!Array.isArray(row) || row.length !== width) errors.push(`${roomId}: row ${rowIndex} width mismatch`)
      for (const tile of row) {
        if (!Object.values(ROOM_TILE_TYPES).includes(tile)) errors.push(`${roomId}: unsupported tile ${tile}`)
      }
    }
    if (!room.contentBounds) errors.push(`${roomId}: contentBounds is required`)
    if (!room.spawn) errors.push(`${roomId}: spawn is required`)
    for (const portal of room.portals ?? []) {
      if (!catalog[portal.to]) errors.push(`${roomId}: portal target ${portal.to} is missing`)
      if (!portal.landing) errors.push(`${roomId}: portal to ${portal.to} requires landing`)
    }
  }
  return errors
}
