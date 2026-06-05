import { describe, expect, it } from 'vitest'

import { deleteSelectedFromRoom } from '../client/src/room-editor/deleteSelection.js'

describe('room editor selected object deletion', () => {
  it('removes selected platforms from the exported room data collection', () => {
    const room = {
      platforms: [
        { tx: 7, ty: 6, tz: 1.7 },
        { tx: 7, ty: 7, tz: 1.7 },
      ],
    }

    expect(deleteSelectedFromRoom(room, { type: 'platform', tx: 7, ty: 6, index: 0 })).toBe(true)

    expect(room.platforms).toEqual([{ tx: 7, ty: 7, tz: 1.7 }])
  })

  it('removes selected portals from the plural portals collection', () => {
    const room = {
      portals: [
        { tx: 9, ty: 7, to: 'dungeon_grove', landing: { tx: 1, ty: 1 } },
        { tx: 10, ty: 7, to: 'overworld', landing: { tx: 2, ty: 2 } },
      ],
    }

    expect(deleteSelectedFromRoom(room, { type: 'portal', tx: 9, ty: 7, index: 0 })).toBe(true)

    expect(room.portals).toEqual([{ tx: 10, ty: 7, to: 'overworld', landing: { tx: 2, ty: 2 } }])
  })

  it('removes selected hidden platforms from the hidden collection', () => {
    const room = {
      hidden: [
        { tx: 8, ty: 7, tz: 1.7 },
        { tx: 8, ty: 8, tz: 1.7 },
      ],
    }

    expect(deleteSelectedFromRoom(room, { type: 'hidden', tx: 8, ty: 7, index: 0 })).toBe(true)

    expect(room.hidden).toEqual([{ tx: 8, ty: 8, tz: 1.7 }])
  })

  it('falls back to tile position when a selected list index is stale', () => {
    const room = {
      platforms: [
        { tx: 1, ty: 1, tz: 1 },
        { tx: 2, ty: 2, tz: 1 },
      ],
    }

    expect(deleteSelectedFromRoom(room, { type: 'platform', tx: 2, ty: 2, index: 0 })).toBe(true)

    expect(room.platforms).toEqual([{ tx: 1, ty: 1, tz: 1 }])
  })

  it('resets selected wall tiles and wall tile metadata', () => {
    const room = {
      grid: [
        [1, 1, 1],
        [1, 2, 1],
      ],
      wallTiles: [[1, 1]],
    }

    expect(deleteSelectedFromRoom(room, { type: 'tile', tx: 1, ty: 1 })).toBe(true)

    expect(room.grid[1][1]).toBe(1)
    expect(room.wallTiles).toEqual([])
  })

  it('does not throw when a selected collection is missing', () => {
    const room = {}

    expect(deleteSelectedFromRoom(room, { type: 'platform', tx: 7, ty: 6, index: 0 })).toBe(false)
    expect(room).toEqual({})
  })
})
