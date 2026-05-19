import { recomputeSkillLevel } from './profile.js'

// Each trigger: roomId, zone bounds (inclusive), action, optional itemName, secretId, effect
const TRIGGERS = [
  {
    secretId: 'secret_wall_crack',
    roomId:   'overworld',
    zone:     { x: [5, 8], y: [5, 8] },
    action:   'jump',
    itemName: null,
    effect:   { type: 'cosmetic', value: 'ghost_white' },
  },
  {
    secretId: 'secret_feather_wind',
    roomId:   'overworld',
    zone:     { x: [10, 13], y: [3, 6] },
    action:   'move',
    itemName: 'Feather',
    effect:   { type: 'area_unlock', value: 'dungeon_sky' },
  },
  {
    secretId: 'secret_deep_dive',
    roomId:   'overworld',
    zone:     { x: [0, 3], y: [10, 13] },
    action:   'dive',
    itemName: null,
    effect:   { type: 'area_unlock', value: 'dungeon_deep' },
  },
]

function matchesTrigger(trigger, { action, roomId, wx, wy, itemName }) {
  return (
    trigger.roomId === roomId &&
    trigger.action === action &&
    wx >= trigger.zone.x[0] && wx <= trigger.zone.x[1] &&
    wy >= trigger.zone.y[0] && wy <= trigger.zone.y[1] &&
    (trigger.itemName === null || trigger.itemName === itemName)
  )
}

export function checkDiscovery(db, playerId, { action, roomId, wx, wy, wz, itemId }) {
  const itemName = itemId
    ? db.prepare('SELECT name FROM items WHERE id = ?').get(itemId)?.name ?? null
    : null

  const trigger = TRIGGERS.find(t => matchesTrigger(t, { action, roomId, wx, wy, itemName }))
  if (!trigger) return null

  const already = db.prepare(
    'SELECT 1 FROM discovered_secrets WHERE player_id = ? AND secret_id = ?'
  ).get(playerId, trigger.secretId)
  if (already) return null

  db.prepare(
    "INSERT INTO discovered_secrets (player_id, secret_id) VALUES (?, ?)"
  ).run(playerId, trigger.secretId)

  if (trigger.effect.type === 'area_unlock') {
    db.prepare(
      'INSERT OR IGNORE INTO unlocked_areas (player_id, area_id) VALUES (?, ?)'
    ).run(playerId, trigger.effect.value)
  }

  recomputeSkillLevel(db, playerId)

  return { secretId: trigger.secretId, effect: trigger.effect }
}
