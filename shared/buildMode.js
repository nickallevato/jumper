import { isRoomPositionPassable } from './constants.js'

export const BUILD_BLOCK = Object.freeze({
  type: 4,
  tz: 0.75,
})

export const BUILD_PLACE_RADIUS = 2.4

export function normalizeBuildPlacement(payload) {
  const tx = Number(payload?.tx)
  const ty = Number(payload?.ty)
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null
  return {
    tx: Math.round(tx),
    ty: Math.round(ty),
    tz: BUILD_BLOCK.tz,
    type: BUILD_BLOCK.type,
  }
}

export function buildPlacementKey({ tx, ty }) {
  return `${tx},${ty}`
}

export function canPlaceBuild(roomId, placement, {
  player = null,
  existing = [],
  openDoorKeys = new Set(),
  portals = [],
} = {}) {
  if (!placement) return { ok: false, reason: 'invalid' }
  if (!Number.isInteger(placement.tx) || !Number.isInteger(placement.ty)) {
    return { ok: false, reason: 'invalid' }
  }
  if (!isRoomPositionPassable(roomId, { x: placement.tx, y: placement.ty }, openDoorKeys)) {
    return { ok: false, reason: 'blocked' }
  }
  if (existing.some(p => p.tx === placement.tx && p.ty === placement.ty)) {
    return { ok: false, reason: 'occupied' }
  }
  if (portals.some(p => p.tx === placement.tx && p.ty === placement.ty)) {
    return { ok: false, reason: 'portal' }
  }
  if (player) {
    const dist = Math.hypot(player.x - placement.tx, player.y - placement.ty)
    if (dist > BUILD_PLACE_RADIUS) return { ok: false, reason: 'range' }
    if (dist < 0.7) return { ok: false, reason: 'player' }
  }
  return { ok: true }
}
