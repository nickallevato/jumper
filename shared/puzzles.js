// Puzzle geometry shared by client and server so positions/heights never drift.
//
// The Counterweight: weighting the pressure plate (with a dropped item OR a player
// standing on it) raises a linked platform across the map. The raised platform is the
// only way up to a high goal ledge — unreachable from the ground (max jump ≈ 1.27 tiles).
export const COUNTERWEIGHT = {
  roomId: 'overworld',
  secretId: 'secret_counterweight',
  // Bright sunken tile players are drawn to step on / drop onto.
  plate: { tx: 11, ty: 12 },
  // Flush with the ground until weighted, then rises to raisedZ.
  riser: { tx: 8, ty: 12, loweredZ: 0, raisedZ: 1.0 },
  // High ledge holding the reward; reachZ = min player height that counts as "reached".
  goal: { tx: 8, ty: 11, tz: 2.0, reachZ: 1.6 },
}

// Proximity helpers (tile units). Generous so the puzzle feels responsive, not finicky.
export const PLATE_RADIUS = 0.7
export const GOAL_RADIUS = 0.6

export function isOnPlate(tx, ty, plate = COUNTERWEIGHT.plate) {
  return Math.hypot(tx - plate.tx, ty - plate.ty) < PLATE_RADIUS
}

export function isAtGoal(tx, ty, tz, goal = COUNTERWEIGHT.goal) {
  return Math.hypot(tx - goal.tx, ty - goal.ty) < GOAL_RADIUS && tz >= goal.reachZ
}
