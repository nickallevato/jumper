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

// Convert screen-relative input intent (mx,my in {-1,0,1}: +x right, +y down on screen)
// into a normalized tile-space direction. Pressing W (screen-up) should move the player
// straight up on screen, not diagonally — so screen-up maps to tile (-1,-1), screen-right
// to (1,-1). Returns {dx,dy} as a unit vector in tile space (or {0,0} when no input).
export function screenToTileDir(mx, my) {
  const dx = mx + my   // screen-right=(1,-1), screen-down=(1,1) → tile dtx = mx + my
  const dy = my - mx   //                                          → tile dty = my - mx
  const len = Math.hypot(dx, dy)
  if (len === 0) return { dx: 0, dy: 0 }
  return { dx: dx / len, dy: dy / len }
}
