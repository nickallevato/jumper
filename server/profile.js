export function getProfile(db, playerId) {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId)
  if (!player) return null

  const areas   = db.prepare('SELECT area_id FROM unlocked_areas WHERE player_id = ?').all(playerId).map(r => r.area_id)
  const secrets = db.prepare('SELECT secret_id FROM discovered_secrets WHERE player_id = ?').all(playerId).map(r => r.secret_id)
  const item    = player.held_item_id
    ? db.prepare('SELECT * FROM items WHERE id = ?').get(player.held_item_id)
    : null

  return { ...player, unlockedAreas: areas, discoveredSecrets: secrets, heldItem: item }
}

export function recomputeSkillLevel(db, playerId) {
  const { area_count } = db.prepare(
    'SELECT COUNT(*) as area_count FROM unlocked_areas WHERE player_id = ?'
  ).get(playerId)
  const { secret_count } = db.prepare(
    'SELECT COUNT(*) as secret_count FROM discovered_secrets WHERE player_id = ?'
  ).get(playerId)

  const level = area_count + secret_count
  db.prepare('UPDATE players SET skill_level = ? WHERE id = ?').run(level, playerId)
  return level
}
