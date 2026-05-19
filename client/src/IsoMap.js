import { toScreen, paintOrder } from './iso.js'
import { TILE_W, TILE_H } from '../../shared/constants.js'

const TILE_COLORS = {
  0: null,         // air — not rendered
  1: 0x4a7c59,    // ground
  2: 0x8b5e3c,    // wall
  3: 0x2a4a6b,    // water
}

export class IsoMap {
  constructor(scene, grid, originX, originY) {
    this.scene = scene
    this.grid = grid
    this.originX = originX
    this.originY = originY
    this._graphics = scene.add.graphics()
    this.draw()
  }

  draw() {
    const g = this._graphics
    g.clear()

    const tiles = []
    for (let ty = 0; ty < this.grid.length; ty++) {
      for (let tx = 0; tx < this.grid[ty].length; tx++) {
        const type = this.grid[ty][tx]
        if (type !== 0) tiles.push({ tx, ty, type })
      }
    }

    for (const tile of paintOrder(tiles)) {
      const color = TILE_COLORS[tile.type]
      if (color === null) continue
      const { x, y } = toScreen(tile.tx, tile.ty, 0, this.originX, this.originY)
      this._drawTile(g, x, y, color)
    }
  }

  _drawTile(g, sx, sy, color) {
    const hw = TILE_W / 2
    const hh = TILE_H / 2
    g.fillStyle(color, 1)
    g.fillPoints([
      { x: sx,      y: sy - hh },
      { x: sx + hw, y: sy },
      { x: sx,      y: sy + hh },
      { x: sx - hw, y: sy },
    ], true)
    g.lineStyle(1, 0x000000, 0.3)
    g.strokePoints([
      { x: sx,      y: sy - hh },
      { x: sx + hw, y: sy },
      { x: sx,      y: sy + hh },
      { x: sx - hw, y: sy },
    ], true)
  }
}
