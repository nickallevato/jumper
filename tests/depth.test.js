import { describe, expect, it } from 'vitest'
import { isoDepth, ISO_DEPTH_ROW, ISO_ENTITY_BIAS } from '../shared/coordinates.js'

describe('isometric display-list depth ordering', () => {
  it('draws tiles one row in front (greater tx+ty) on top', () => {
    expect(isoDepth(3, 3, 0)).toBeLessThan(isoDepth(3, 4, 0))
    expect(isoDepth(3, 3, 0)).toBeLessThan(isoDepth(4, 3, 0))
  })

  it('among the same row, taller tiles draw on top', () => {
    expect(isoDepth(3, 3, 0)).toBeLessThan(isoDepth(3, 3, 1.5))
  })

  it('a tile one row in front occludes an entity (entity bias stays within a row)', () => {
    // player at (3,3) on the ground; a mountain/cliff at (3,4) is in front
    const player = isoDepth(3, 3, 0) + ISO_ENTITY_BIAS
    const cliffInFront = isoDepth(3, 4, 0)
    expect(player).toBeLessThan(cliffInFront)
  })

  it('an entity draws on top of the tile it stands on (same cell), even a tall pillar', () => {
    const pillar = isoDepth(3, 3, 5.4) // tallest authored ledge
    const playerOnIt = isoDepth(3, 3, 5.4) + ISO_ENTITY_BIAS
    expect(playerOnIt).toBeGreaterThan(pillar)
  })

  it('an entity occludes tiles one row behind it', () => {
    const player = isoDepth(3, 3, 0) + ISO_ENTITY_BIAS
    const tileBehind = isoDepth(2, 3, 1)
    expect(player).toBeGreaterThan(tileBehind)
  })

  it('entity bias is smaller than one row so it never crosses rows', () => {
    expect(ISO_ENTITY_BIAS).toBeGreaterThan(0)
    expect(ISO_ENTITY_BIAS).toBeLessThan(ISO_DEPTH_ROW)
  })
})
