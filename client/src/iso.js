import { TILE_W, TILE_H } from '../../shared/constants.js'

const HW = TILE_W / 2   // 32
const HH = TILE_H / 2   // 16

export function toScreen(tx, ty, tz, originX, originY) {
  return {
    x: (tx - ty) * HW + originX,
    y: (tx + ty) * HH - tz * TILE_H + originY,
  }
}

export function toWorld(screenX, screenY, originX, originY) {
  const sx = screenX - originX
  const sy = screenY - originY
  return {
    tx: (sx / HW + sy / HH) / 2,
    ty: (sy / HH - sx / HW) / 2,
  }
}

// Sort an array of objects with tx/ty properties back-to-front for painter's order
export function paintOrder(tiles) {
  return [...tiles].sort((a, b) => (a.tx + a.ty) - (b.tx + b.ty))
}
