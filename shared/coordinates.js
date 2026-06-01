import { TILE_H, TILE_W, MAX_POSITION_ABS, MAX_Z_ABS } from './constants.js'

export const TILE_HW = TILE_W / 2
export const TILE_HH = TILE_H / 2

export const ISO_ANCHOR_CONVENTION =
  'Entity visual bases are anchored at the top-face diamond center returned by toScreen(tx, ty, tz).'

export function toScreen(tx, ty, tz = 0, originX = 0, originY = 0) {
  return {
    x: (tx - ty) * TILE_HW + originX,
    y: (tx + ty) * TILE_HH - tz * TILE_H + originY,
  }
}

export function screenToTile(screenX, screenY, originX = 0, originY = 0) {
  const sx = screenX - originX
  const sy = screenY - originY
  return {
    tx: (sx / TILE_HW + sy / TILE_HH) / 2,
    ty: (sy / TILE_HH - sx / TILE_HW) / 2,
  }
}

export const toWorld = screenToTile

// Sort an array of objects with tx/ty properties back-to-front for painter's order.
export function paintOrder(tiles) {
  return [...tiles].sort((a, b) => (a.tx + a.ty) - (b.tx + b.ty))
}

// Convert screen-relative input intent (mx,my in {-1,0,1}: +x right, +y down on screen)
// into a normalized tile-space direction.
export function screenToTileDir(mx, my) {
  const dx = mx + my
  const dy = my - mx
  const len = Math.hypot(dx, dy)
  if (len === 0) return { dx: 0, dy: 0 }
  return { dx: dx / len, dy: dy / len }
}

export function topDiamondPoints(sx = 0, sy = 0) {
  return [
    { x: sx, y: sy - TILE_HH },
    { x: sx + TILE_HW, y: sy },
    { x: sx, y: sy + TILE_HH },
    { x: sx - TILE_HW, y: sy },
  ]
}

export function blockFacePoints(sx, sy, depth) {
  return {
    left: [
      { x: sx - TILE_HW, y: sy },
      { x: sx, y: sy + TILE_HH },
      { x: sx, y: sy + TILE_HH + depth },
      { x: sx - TILE_HW, y: sy + depth },
    ],
    right: [
      { x: sx, y: sy + TILE_HH },
      { x: sx + TILE_HW, y: sy },
      { x: sx + TILE_HW, y: sy + depth },
      { x: sx, y: sy + TILE_HH + depth },
    ],
    top: topDiamondPoints(sx, sy),
  }
}

export function isValidTilePosition({ x, y, z }) {
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) &&
    Math.abs(x) <= MAX_POSITION_ABS &&
    Math.abs(y) <= MAX_POSITION_ABS &&
    Math.abs(z) <= MAX_Z_ABS
}
