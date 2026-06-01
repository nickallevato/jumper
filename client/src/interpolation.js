// Remote-entity snapshot interpolation.
//
// Remote players arrive as authoritative snapshots at the 20 Hz tick rate. The
// previous approach exponentially eased the rendered position toward the latest
// snapshot, which always trails a moving target and produces uneven,
// rubber-bandy motion that reads as network/RTT lag.
//
// Instead we buffer timestamped snapshots and render each remote entity a fixed
// delay in the PAST (REMOTE_RENDER_DELAY_MS), linearly interpolating between the
// two snapshots that bracket that render time. Evenly-spaced ticks then yield
// constant-velocity motion — smooth, no easing artefacts — at the cost of a
// small, fixed render latency on OTHER players (never on the local player,
// which is client-predicted).

// One render frame behind ~2 server ticks: enough to always have a "next"
// snapshot to interpolate toward even with mild packet jitter.
export const REMOTE_RENDER_DELAY_MS = 100

function pick(s) {
  return { x: s.x, y: s.y, z: s.z }
}

// Append a snapshot, keeping at most `max` most-recent entries.
export function pushSnapshot(buffer, snap, max = 12) {
  const next = buffer.concat([snap])
  if (next.length > max) next.splice(0, next.length - max)
  return next
}

// Interpolate the position at `renderTime`. Clamps (holds) at the buffer ends
// rather than extrapolating, so we never overshoot past a known position.
export function sampleSnapshots(buffer, renderTime) {
  if (!buffer.length) return null
  if (buffer.length === 1) return pick(buffer[0])
  if (renderTime <= buffer[0].t) return pick(buffer[0])
  const last = buffer[buffer.length - 1]
  if (renderTime >= last.t) return pick(last)
  for (let i = 0; i < buffer.length - 1; i++) {
    const a = buffer[i]
    const b = buffer[i + 1]
    if (renderTime >= a.t && renderTime <= b.t) {
      const span = b.t - a.t
      const f = span > 0 ? (renderTime - a.t) / span : 0
      return {
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        z: a.z + (b.z - a.z) * f,
      }
    }
  }
  return pick(last)
}

// Drop snapshots older than the pair bracketing `renderTime`, so the buffer
// does not grow unbounded. Keeps the last snapshot at or before renderTime and
// everything after it.
export function pruneSnapshots(buffer, renderTime) {
  if (buffer.length <= 2) return buffer
  let keepFrom = 0
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i].t <= renderTime) keepFrom = i
    else break
  }
  return keepFrom > 0 ? buffer.slice(keepFrom) : buffer
}
