import { describe, it, expect } from 'vitest'
import {
  ISO_ANCHOR_CONVENTION,
  blockFacePoints,
  clampTileCoordinate,
  isValidTilePosition,
  paintOrder,
  screenToTile,
  screenToTileDir,
  toScreen,
  toWorld,
  topDiamondPoints,
} from '../shared/coordinates.js'
import { TILE_H } from '../shared/constants.js'
import { ROOMS } from '../client/src/maps.js'

const MAX_JUMP_HEIGHT = 1.27

function isWalkableTile(room, tx, ty) {
  return room.grid[ty]?.[tx] === 1 || room.grid[ty]?.[tx] === 3
}

function roomSize(room) {
  return {
    cols: room.grid[0].length,
    rows: room.grid.length,
  }
}

function isInBounds(room, tx, ty) {
  const { cols, rows } = roomSize(room)
  return tx >= 0 && ty >= 0 && tx < cols && ty < rows
}

function reachableGroundTiles(room, start) {
  const startKey = `${start.tx},${start.ty}`
  const seen = new Set([startKey])
  const queue = [start]

  while (queue.length > 0) {
    const cur = queue.shift()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { tx: cur.tx + dx, ty: cur.ty + dy }
      const key = `${next.tx},${next.ty}`
      if (seen.has(key) || !isWalkableTile(room, next.tx, next.ty)) continue
      seen.add(key)
      queue.push(next)
    }
  }

  return seen
}

// TILE_W=64, TILE_H=32. ORIGIN assumed (0,0) for math tests.
describe('iso', () => {
  it('toScreen: tile (0,0,0) maps to (0,0)', () => {
    const s = toScreen(0, 0, 0, 0, 0)
    expect(s.x).toBe(0)
    expect(s.y).toBe(0)
  })

  it('toScreen: tile (1,0,0) maps to (32, 16)', () => {
    const s = toScreen(1, 0, 0, 0, 0)
    expect(s.x).toBe(32)
    expect(s.y).toBe(16)
  })

  it('toScreen: tile (0,1,0) maps to (-32, 16)', () => {
    const s = toScreen(0, 1, 0, 0, 0)
    expect(s.x).toBe(-32)
    expect(s.y).toBe(16)
  })

  it('toScreen: z=1 raises screenY by TILE_H (32)', () => {
    const ground = toScreen(0, 0, 0, 0, 0)
    const raised = toScreen(0, 0, 1, 0, 0)
    expect(raised.y).toBe(ground.y - 32)
  })

  it('toWorld: round-trips toScreen at z=0', () => {
    const w = toWorld(32, 16, 0, 0)
    expect(Math.round(w.tx)).toBe(1)
    expect(Math.round(w.ty)).toBe(0)
  })

  it('screenToTile: golden coordinates round-trip at z=0 with origin', () => {
    const origin = { x: 400, y: 80 }
    const cases = [
      { tx: 0, ty: 0 },
      { tx: 5, ty: 8 },
      { tx: -2.5, ty: 3.25 },
      { tx: 11.75, ty: -4.5 },
    ]
    for (const c of cases) {
      const s = toScreen(c.tx, c.ty, 0, origin.x, origin.y)
      const t = screenToTile(s.x, s.y, origin.x, origin.y)
      expect(t.tx).toBeCloseTo(c.tx)
      expect(t.ty).toBeCloseTo(c.ty)
    }
  })

  it('screenToTile: z-aware screen points round-trip after height compensation', () => {
    const origin = { x: -128, y: 96 }
    const cases = [
      { tx: 0, ty: 0, tz: 0 },
      { tx: 7, ty: 5, tz: 1 },
      { tx: 4.25, ty: 9.5, tz: 2.75 },
      { tx: -3.5, ty: 6.25, tz: 0.5 },
    ]

    for (const c of cases) {
      const s = toScreen(c.tx, c.ty, c.tz, origin.x, origin.y)
      const t = screenToTile(s.x, s.y + c.tz * TILE_H, origin.x, origin.y)
      expect(t.tx).toBeCloseTo(c.tx)
      expect(t.ty).toBeCloseTo(c.ty)
    }
  })

  it('clampTileCoordinate keeps movement inside room tile bounds', () => {
    expect(clampTileCoordinate(-0.5, 16)).toBe(0)
    expect(clampTileCoordinate(8.25, 16)).toBe(8.25)
    expect(clampTileCoordinate(16, 16)).toBe(15.99)
    expect(clampTileCoordinate(99, 16)).toBe(15.99)
  })

  it('documents entity base anchor convention', () => {
    expect(ISO_ANCHOR_CONVENTION).toContain('top-face diamond center')
    expect(toScreen(3, 4, 2, 100, 50)).toEqual({ x: 68, y: 98 })
  })

  it('paintOrder: lower tx+ty sorts first', () => {
    const tiles = [
      { tx: 2, ty: 2 }, { tx: 0, ty: 0 }, { tx: 1, ty: 0 },
    ]
    const sorted = paintOrder(tiles)
    expect(sorted[0]).toEqual({ tx: 0, ty: 0 })
    expect(sorted[2]).toEqual({ tx: 2, ty: 2 })
  })

  it('screenToTileDir: no input → zero vector', () => {
    expect(screenToTileDir(0, 0)).toEqual({ dx: 0, dy: 0 })
  })

  it('screenToTileDir: W (screen-up) moves straight up on screen', () => {
    // tile dir for W is (-1,-1); feeding it back through toScreen must change only Y (up), not X.
    const w = screenToTileDir(0, -1)
    const a = toScreen(0, 0, 0, 0, 0)
    const b = toScreen(w.dx, w.dy, 0, 0, 0)
    expect(b.x).toBeCloseTo(a.x)      // no horizontal drift
    expect(b.y).toBeLessThan(a.y)     // moves up
  })

  it('screenToTileDir: D (screen-right) moves straight right on screen', () => {
    const d = screenToTileDir(1, 0)
    const a = toScreen(0, 0, 0, 0, 0)
    const b = toScreen(d.dx, d.dy, 0, 0, 0)
    expect(b.y).toBeCloseTo(a.y)      // no vertical drift
    expect(b.x).toBeGreaterThan(a.x)  // moves right
  })

  it('screenToTileDir: results are unit-length and W+D collapses to one tile axis', () => {
    const w = screenToTileDir(0, -1)
    expect(Math.hypot(w.dx, w.dy)).toBeCloseTo(1)
    const wd = screenToTileDir(1, -1)   // up-right → pure -ty axis
    expect(wd.dx).toBeCloseTo(0)
    expect(wd.dy).toBeCloseTo(-1)
  })

  it('topDiamondPoints and blockFacePoints use canonical tile dimensions', () => {
    expect(topDiamondPoints()).toEqual([
      { x: 0, y: -16 },
      { x: 32, y: 0 },
      { x: 0, y: 16 },
      { x: -32, y: 0 },
    ])
    expect(blockFacePoints(10, 20, 7).top).toEqual(topDiamondPoints(10, 20))
  })

  it('isValidTilePosition rejects non-finite and absurd positions', () => {
    expect(isValidTilePosition({ x: 8, y: 8, z: 0 })).toBe(true)
    expect(isValidTilePosition({ x: Infinity, y: 8, z: 0 })).toBe(false)
    expect(isValidTilePosition({ x: 3000, y: 8, z: 0 })).toBe(false)
    expect(isValidTilePosition({ x: 8, y: 8, z: 100 })).toBe(false)
  })

  it('room spawns are in bounds and on solid ground', () => {
    for (const [roomId, room] of Object.entries(ROOMS)) {
      expect(room.spawn, roomId).toBeDefined()
      expect(isInBounds(room, room.spawn.tx, room.spawn.ty), roomId).toBe(true)
      expect(room.grid[room.spawn.ty][room.spawn.tx], roomId).toBe(1)
    }
  })

  it('room bounds contain all authored traversal coordinates', () => {
    for (const [roomId, room] of Object.entries(ROOMS)) {
      const authoredPoints = [
        room.spawn,
        ...(room.portals ?? []),
        ...(room.platforms ?? []),
        ...(room.hidden ?? []),
        ...(room.doors ?? []),
      ]

      for (const point of authoredPoints) {
        expect(isInBounds(room, point.tx, point.ty), `${roomId} ${JSON.stringify(point)}`).toBe(true)
      }
    }
  })

  it('room portals stay reachable from spawn on ground tiles', () => {
    for (const [roomId, room] of Object.entries(ROOMS)) {
      const reachable = reachableGroundTiles(room, room.spawn)

      for (const portal of room.portals ?? []) {
        expect(reachable.has(`${portal.tx},${portal.ty}`), `${roomId} portal ${portal.tx},${portal.ty}`).toBe(true)
      }
    }
  })

  it('authored platform chains preserve intentional reachability', () => {
    for (const [roomId, room] of Object.entries(ROOMS)) {
      let current = { tx: room.spawn.tx, ty: room.spawn.ty, tz: 0 }

      for (const platform of room.platforms ?? []) {
        const dz = platform.tz - current.tz
        expect(dz, `${roomId} platform ${platform.tx},${platform.ty},${platform.tz}`).toBeLessThanOrEqual(MAX_JUMP_HEIGHT)
        current = platform
      }
    }
  })
})
