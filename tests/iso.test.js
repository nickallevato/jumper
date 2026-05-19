import { describe, it, expect } from 'vitest'
import { toScreen, toWorld, paintOrder } from '../client/src/iso.js'

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

  it('paintOrder: lower tx+ty sorts first', () => {
    const tiles = [
      { tx: 2, ty: 2 }, { tx: 0, ty: 0 }, { tx: 1, ty: 0 },
    ]
    const sorted = paintOrder(tiles)
    expect(sorted[0]).toEqual({ tx: 0, ty: 0 })
    expect(sorted[2]).toEqual({ tx: 2, ty: 2 })
  })
})
