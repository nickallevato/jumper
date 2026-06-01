import { blockFacePoints, paintOrder, toScreen, isoDepth } from '../../shared/coordinates.js'
import { TILE_H } from '../../shared/constants.js'

const STYLES = {
  1: { top: 0x4c8b5e, left: 0x2d5c3b, right: 0x1b3c26, depth: 10 },
  2: { top: 0x6272a4, left: 0x3a3d5c, right: 0x22243a, depth: 38 },
  3: { top: 0x3b82c4, left: 0x1e5a8c, right: 0x103659, depth: 10 },
  4: { top: 0x7aaa6a, left: 0x4a6e3c, right: 0x2e4824, depth: 10 }, // elevated platform
}

const WALL_HEIGHT = 1   // walls render one tile tall (rising above the floor)

// Deterministic per-tile shade in [-amt, amt] so flat ground/water gets subtle texture
// instead of reading as one uniform plane. Stable across redraws (hashes tile coords).
function tileShade(tx, ty, amt = 0.07) {
  let h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0
  return ((h % 1000) / 1000 - 0.5) * 2 * amt
}

function shade(color, f) {
  const cl = v => Math.max(0, Math.min(255, Math.round(v)))
  const r = cl(((color >> 16) & 255) * (1 + f))
  const g = cl(((color >> 8) & 255) * (1 + f))
  const b = cl((color & 255) * (1 + f))
  return (r << 16) | (g << 8) | b
}

export class IsoMap {
  constructor(scene, grid, originX, originY, platforms = []) {
    this.scene = scene
    this.grid = grid
    this.originX = originX
    this.originY = originY
    this.platforms = platforms
    // Flat ground/water shares one background layer, always behind entities.
    this._graphics = scene.add.graphics()
    this._graphics.setDepth(-1)
    // Each raised tile (wall/cliff/platform) is its own object so the display
    // list can depth-sort it against the player — letting a mountain in front
    // occlude a player walking behind it.
    this._raised = []
    this.draw()
  }

  draw() {
    const g = this._graphics
    g.clear()
    for (const r of this._raised) r.destroy()
    this._raised = []

    const flat = []
    const raised = []

    for (let ty = 0; ty < this.grid.length; ty++) {
      for (let tx = 0; tx < this.grid[ty].length; tx++) {
        const type = this.grid[ty][tx]
        if (type === 0) continue
        // Walls render as raised blocks (top one tile up, body down to the ground) so they
        // rise above the floor — drawing them at tz=0 made them sunken, so the player next
        // to a wall looked half a tile too high. Ground/water stay flat at tz=0.
        const tz = type === 2 ? WALL_HEIGHT : 0
        ;(tz > 0 ? raised : flat).push({ tx, ty, tz, type })
      }
    }

    for (const p of this.platforms) {
      const tile = { tx: p.tx, ty: p.ty, tz: p.tz, type: p.type ?? 4 }
      ;(tile.tz > 0 ? raised : flat).push(tile)
    }

    // Flat tiles: painter-ordered onto the single background layer (they never
    // occlude entities, so internal draw order is enough).
    for (const tile of paintOrder(flat)) this._paintTile(g, tile)

    // Raised tiles: each on its own graphics, depth-sorted by iso position.
    for (const tile of raised) {
      const style = STYLES[tile.type]
      if (!style) continue
      const rg = this.scene.add.graphics()
      rg.setDepth(isoDepth(tile.tx, tile.ty, tile.tz))
      this._paintTile(rg, tile)
      this._raised.push(rg)
    }
  }

  _paintTile(g, tile) {
    const style = STYLES[tile.type]
    if (!style) return
    const { x, y } = toScreen(tile.tx, tile.ty, tile.tz, this.originX, this.originY)
    // Raised tiles (walls, platforms) draw their sides down to the ground so they read
    // as solid blocks/pillars; flat tiles keep their thin lip.
    const depth = tile.tz > 0 ? tile.tz * TILE_H + 10 : style.depth
    // Flat ground/water gets a subtle deterministic top-color jitter for texture.
    const topColor = (tile.type === 1 || tile.type === 3)
      ? shade(style.top, tileShade(tile.tx, tile.ty))
      : style.top
    this._drawTile(g, x, y, style, depth, topColor)
  }

  _drawTile(g, sx, sy, style, depth, topColor) {
    const D  = depth ?? style.depth
    const faces = blockFacePoints(sx, sy, D)

    g.fillStyle(style.left, 1)
    g.fillPoints(faces.left, true)

    g.fillStyle(style.right, 1)
    g.fillPoints(faces.right, true)

    g.fillStyle(topColor ?? style.top, 1)
    g.fillPoints(faces.top, true)
  }
}
