// Standing-surface ("ground height") model.
//
// Platforms are raised tiles {tx, ty, tz}. The height of the surface a player
// stands on at a given tile is the tallest platform on that tile, or 0 (plain
// ground). This is the single source of truth for: where you land, whether you
// fall when you walk off an edge, and whether you may walk onto a tile at all.
//
// Traversal rule (Jumper pillar — depth from simple verbs): you cannot WALK up
// onto a higher surface; you must jump. You can always walk onto a lower (or
// equal) surface — and you then fall to it.

// Small tolerance so floating-point equality at the same height still counts as
// "level ground" rather than a (blocked) step up.
export const WALK_STEP_TOLERANCE = 0.05

export function groundHeightAt(platforms, tx, ty) {
  const rx = Math.round(tx)
  const ry = Math.round(ty)
  let h = 0
  for (const p of platforms) {
    if (p.tx === rx && p.ty === ry && p.tz > h) h = p.tz
  }
  return h
}

// May a grounded player step horizontally onto (tx,ty) from standing height
// currentZ? Allowed only if the target surface is not meaningfully higher than
// where they already stand (otherwise they must jump up).
export function canStepTo(platforms, tx, ty, currentZ, tolerance = WALK_STEP_TOLERANCE) {
  return groundHeightAt(platforms, tx, ty) <= currentZ + tolerance
}
