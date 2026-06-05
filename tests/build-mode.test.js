import { describe, expect, it } from 'vitest'
import {
  BUILD_BLOCK,
  canPlaceBuild,
  normalizeBuildPlacement,
} from '../shared/buildMode.js'

describe('build mode placement', () => {
  it('normalizes pointer payloads into build blocks', () => {
    expect(normalizeBuildPlacement({ tx: 4.2, ty: 5.7 })).toEqual({
      tx: 4,
      ty: 6,
      tz: BUILD_BLOCK.tz,
      type: BUILD_BLOCK.type,
    })
    expect(normalizeBuildPlacement({ tx: 'nope', ty: 1 })).toBeNull()
  })

  it('allows nearby placement on passable room catalog tiles', () => {
    const placement = normalizeBuildPlacement({ tx: 8, ty: 9 })
    expect(canPlaceBuild('overworld', placement, {
      player: { x: 8, y: 8 },
      existing: [],
      portals: [],
    })).toEqual({ ok: true })
  })

  it('rejects blocked, duplicate, portal, distant, and self placements', () => {
    expect(canPlaceBuild('overworld', normalizeBuildPlacement({ tx: 3, ty: 2 }), {
      player: { x: 3, y: 3 },
    })).toEqual({ ok: false, reason: 'blocked' })

    expect(canPlaceBuild('overworld', normalizeBuildPlacement({ tx: 8, ty: 9 }), {
      player: { x: 8, y: 8 },
      existing: [{ tx: 8, ty: 9 }],
    })).toEqual({ ok: false, reason: 'occupied' })

    expect(canPlaceBuild('overworld', normalizeBuildPlacement({ tx: 13, ty: 13 }), {
      player: { x: 13, y: 12 },
      portals: [{ tx: 13, ty: 13 }],
    })).toEqual({ ok: false, reason: 'portal' })

    expect(canPlaceBuild('overworld', normalizeBuildPlacement({ tx: 14, ty: 14 }), {
      player: { x: 8, y: 8 },
    })).toEqual({ ok: false, reason: 'range' })

    expect(canPlaceBuild('overworld', normalizeBuildPlacement({ tx: 8, ty: 8 }), {
      player: { x: 8.1, y: 8.1 },
    })).toEqual({ ok: false, reason: 'player' })
  })
})
