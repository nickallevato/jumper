export const COOP_CAMERA_RADIUS_TILES = 15
export const COOP_CAMERA_BLEND = 0.65
export const CAMERA_TARGET_DEADBAND_PX = 1.25

export function tileDistance(a, b) {
  return Math.hypot((a.x ?? a.tx) - (b.x ?? b.tx), (a.y ?? a.ty) - (b.y ?? b.ty))
}

export function computeCoopCameraTarget(localScreen, teammateScreens, blend = COOP_CAMERA_BLEND) {
  if (!teammateScreens.length) return { x: localScreen.x, y: localScreen.y }

  let sx = localScreen.x
  let sy = localScreen.y
  for (const p of teammateScreens) {
    sx += p.x
    sy += p.y
  }

  const n = teammateScreens.length + 1
  const centroid = { x: sx / n, y: sy / n }
  return {
    x: localScreen.x + (centroid.x - localScreen.x) * blend,
    y: localScreen.y + (centroid.y - localScreen.y) * blend,
  }
}

export function shouldMoveCameraTarget(current, next, deadbandPx = CAMERA_TARGET_DEADBAND_PX) {
  if (!current) return true
  return Math.hypot(next.x - current.x, next.y - current.y) >= deadbandPx
}
