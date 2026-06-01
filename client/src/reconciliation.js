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

// Positions within this distance are treated as identical — i.e. the server
// accepted the client's predicted move verbatim.
export const RECONCILE_EPSILON = 0.01

// Ack-based client-side prediction reconciliation.
//
// The server is authoritative but trust-based: it echoes back (possibly
// clamped) the positions the client reported, tagged with the sequence number
// of the last input it processed (`server.seq`). The client keeps a buffer of
// the positions it predicted for each input it sent (`pendingInputs`).
//
// We compare the server's authoritative position against the client's OWN
// predicted position at the acked sequence — NOT against the client's current
// position. If they match, the server accepted the move and there is nothing
// to correct, even though the client has since predicted further ahead. This
// is what kills the rubber-banding: a stale tick echoing accepted movement no
// longer drags the local player backward.
//
// Returns { apply, correction:{dx,dy,dz}, ackSeq, matched }. `correction` is an
// offset the caller adds to the current local position so an authoritative
// correction (wall clamp / bounds / fall-out) is applied while preserving the
// un-acked movement the player has predicted since.
export function reconcilePrediction(server, pendingInputs = [], epsilon = RECONCILE_EPSILON) {
  const ackSeq = server?.seq
  const none = { apply: false, correction: { dx: 0, dy: 0, dz: 0 }, ackSeq: ackSeq ?? null, matched: false }
  if (ackSeq == null) return none
  const acked = pendingInputs.find((p) => p.seq === ackSeq)
  if (!acked) return none
  const dx = (server.x ?? 0) - (acked.x ?? 0)
  const dy = (server.y ?? 0) - (acked.y ?? 0)
  const dz = (server.z ?? 0) - (acked.z ?? 0)
  const apply = Math.abs(dx) > epsilon || Math.abs(dy) > epsilon || Math.abs(dz) > epsilon
  return { apply, correction: { dx, dy, dz }, ackSeq, matched: true }
}

// Drop inputs the server has already acknowledged, keep the in-flight ones.
export function pruneAckedInputs(pendingInputs = [], ackSeq) {
  if (ackSeq == null) return pendingInputs
  return pendingInputs.filter((p) => p.seq > ackSeq)
}
