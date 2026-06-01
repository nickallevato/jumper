import { describe, it, expect } from 'vitest'
import {
  ISO_ANCHOR_CONVENTION,
  blockFacePoints,
  isValidTilePosition,
  paintOrder,
  screenToTile,
  screenToTileDir,
  toScreen,
  toWorld,
  topDiamondPoints,
} from '../shared/coordinates.js'

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
})
