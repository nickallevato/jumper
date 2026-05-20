import { toScreen } from './iso.js'
import { TILE_W, TILE_H } from '../../shared/constants.js'

const STYLES = {
  1: { top: 0x4c8b5e, left: 0x2d5c3b, right: 0x1b3c26, depth: 10 },
  2: { top: 0x6272a4, left: 0x3a3d5c, right: 0x22243a, depth: 38 },
  3: { top: 0x3b82c4, left: 0x1e5a8c, right: 0x103659, depth: 10 },
  4: { top: 0x7aaa6a, left: 0x4a6e3c, right: 0x2e4824, depth: 10 }, // elevated platform
}

export class IsoMap {
  constructor(scene, grid, originX, originY, platforms = []) {
    this.scene = scene
    this.grid = grid
    this.originX = originX
    this.originY = originY
    this.platforms = platforms
    this._graphics = scene.add.graphics()
    this.draw()
  }

  draw() {
    const g = this._graphics
    g.clear()

    const all = []

    for (let ty = 0; ty < this.grid.length; ty++) {
      for (let tx = 0; tx < this.grid[ty].length; tx++) {
        const type = this.grid[ty][tx]
        if (type !== 0) all.push({ tx, ty, tz: 0, type })
      }
    }

    for (const p of this.platforms) {
      all.push({ tx: p.tx, ty: p.ty, tz: p.tz, type: p.type ?? 4 })
    }

    // Back-to-front: lower tx+ty first; same sum → lower tz first
    all.sort((a, b) => {
      const d = (a.tx + a.ty) - (b.tx + b.ty)
      return d !== 0 ? d : a.tz - b.tz
    })

    for (const tile of all) {
      const style = STYLES[tile.type]
      if (!style) continue
      const { x, y } = toScreen(tile.tx, tile.ty, tile.tz, this.originX, this.originY)
      // Raised tiles render as full-height pillars to the ground so their elevation
      // is legible (and a player standing on top clearly reads as "up high").
      const depth = tile.tz > 0 ? tile.tz * TILE_H + style.depth : style.depth
      this._drawTile(g, x, y, style, depth)
    }
  }

  _drawTile(g, sx, sy, style, depth) {
    const hw = TILE_W / 2
    const hh = TILE_H / 2
    const D  = depth ?? style.depth

    g.fillStyle(style.left, 1)
    g.fillPoints([
      { x: sx - hw, y: sy },
      { x: sx,      y: sy + hh },
      { x: sx,      y: sy + hh + D },
      { x: sx - hw, y: sy + D },
    ], true)

    g.fillStyle(style.right, 1)
    g.fillPoints([
      { x: sx,      y: sy + hh },
      { x: sx + hw, y: sy },
      { x: sx + hw, y: sy + D },
      { x: sx,      y: sy + hh + D },
    ], true)

    g.fillStyle(style.top, 1)
    g.fillPoints([
      { x: sx,      y: sy - hh },
      { x: sx + hw, y: sy },
      { x: sx,      y: sy + hh },
      { x: sx - hw, y: sy },
    ], true)
  }
}
