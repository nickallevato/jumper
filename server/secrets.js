import { recomputeSkillLevel } from './profile.js'
import { cosmeticIdForUnlock } from '../shared/cosmetics.js'

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
  // Movement techniques — position-independent (zone omitted).
  {
    secretId: 'secret_wall_kick',
    roomId:   'overworld',
    action:   'wall_kick',
    itemName: null,
    effect:   { type: 'cosmetic', value: 'wall_jumper' },
  },
  {
    secretId: 'secret_head_bounce',
    roomId:   'overworld',
    action:   'head_bounce',
    itemName: null,
    effect:   { type: 'cosmetic', value: 'spring_step' },
  },
  {
    secretId: 'secret_pogo',
    roomId:   'overworld',
    action:   'pogo',
    itemName: null,
    effect:   { type: 'cosmetic', value: 'pogo_master' },
  },
  {
    secretId: 'secret_counterweight',
    roomId:   'overworld',
    zone:     { x: [8, 8], y: [11, 11] },
    action:   'reach_counterweight',
    itemName: null,
    effect:   { type: 'cosmetic', value: 'counterweight' },
  },
  {
    secretId: 'secret_locksmith',
    roomId:   'dungeon_grove',
    action:   'unlock_door',
    itemName: null,
    effect:   { type: 'cosmetic', value: 'locksmith' },
  },
  {
    secretId: 'secret_illuminated',
    roomId:   'dungeon_grove',
    zone:     { x: [7, 7], y: [6, 6] },
    action:   'move',
    itemName: 'Lantern',
    effect:   { type: 'cosmetic', value: 'illuminated' },
  },
  {
    secretId: 'secret_bell',
    roomId:   'dungeon_belltower',
    zone:     { x: [3, 3], y: [1, 1] },
    action:   'ring_bell',
    itemName: null,
    effect:   { type: 'cosmetic', value: 'bell_ringer' },
  },
]

function matchesTrigger(trigger, { action, roomId, wx, wy, itemName }) {
  const inZone = !trigger.zone || (
    wx >= trigger.zone.x[0] && wx <= trigger.zone.x[1] &&
    wy >= trigger.zone.y[0] && wy <= trigger.zone.y[1]
  )
  return (
    trigger.roomId === roomId &&
    trigger.action === action &&
    inZone &&
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

  // Equip the unlocked cosmetic so the player's appearance reflects what they've done.
  if (trigger.effect.type === 'cosmetic') {
    const cosmeticId = cosmeticIdForUnlock(trigger.secretId)
    if (cosmeticId) db.prepare('UPDATE players SET cosmetic_id = ? WHERE id = ?').run(cosmeticId, playerId)
  }

  recomputeSkillLevel(db, playerId)

  return { secretId: trigger.secretId, effect: trigger.effect }
}
