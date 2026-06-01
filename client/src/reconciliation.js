export const LOCAL_RECONCILE_XY_THRESHOLD = 0.5
export const LOCAL_RECONCILE_Z_THRESHOLD = 1.25

function delta(a, b) {
  return Math.abs((a ?? 0) - (b ?? 0))
}

export function localServerDivergence(local, server) {
  return {
    dx: delta(local.tx, server.x),
    dy: delta(local.ty, server.y),
    dz: delta(local.tz, server.z),
  }
}

export function shouldApplyLocalServerCorrection(local, server, thresholds = {}) {
  const xyThreshold = thresholds.xy ?? LOCAL_RECONCILE_XY_THRESHOLD
  const zThreshold = thresholds.z ?? LOCAL_RECONCILE_Z_THRESHOLD
  const { dx, dy, dz } = localServerDivergence(local, server)
  return dx > xyThreshold || dy > xyThreshold || dz > zThreshold
}
