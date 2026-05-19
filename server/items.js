export function pickupItem(db, playerId, worldItemId) {
  const player = db.prepare('SELECT held_item_id FROM players WHERE id = ?').get(playerId)
  if (!player) return { ok: false, reason: 'player_not_found' }
  if (player.held_item_id !== null) return { ok: false, reason: 'already_holding' }

  const worldItem = db.prepare('SELECT * FROM world_items WHERE id = ?').get(worldItemId)
  if (!worldItem) return { ok: false, reason: 'item_not_found' }

  db.prepare('UPDATE players SET held_item_id = ? WHERE id = ?').run(worldItem.item_id, playerId)
  db.prepare('DELETE FROM world_items WHERE id = ?').run(worldItemId)

  return { ok: true, itemId: worldItem.item_id }
}

export function dropItem(db, playerId, wx, wy, wz, roomId) {
  const player = db.prepare('SELECT held_item_id FROM players WHERE id = ?').get(playerId)
  if (!player || player.held_item_id === null) return { ok: false, reason: 'not_holding' }

  const result = db.prepare(
    'INSERT INTO world_items (item_id, room_id, wx, wy, wz) VALUES (?, ?, ?, ?, ?)'
  ).run(player.held_item_id, roomId, wx, wy, wz)

  db.prepare('UPDATE players SET held_item_id = NULL WHERE id = ?').run(playerId)

  return { ok: true, worldItemId: result.lastInsertRowid, itemId: player.held_item_id }
}

export function useItem(db, playerId, triggerId) {
  const player = db.prepare('SELECT held_item_id FROM players WHERE id = ?').get(playerId)
  if (!player || player.held_item_id === null) return { ok: false, reason: 'not_holding' }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(player.held_item_id)
  if (!item || item.world_trigger !== triggerId) return { ok: false, reason: 'wrong_item' }

  return { ok: true, effect: item.world_trigger, itemId: item.id }
}

export function getWorldItems(db, roomId) {
  return db.prepare(
    'SELECT wi.id as worldItemId, wi.wx, wi.wy, wi.wz, i.id as itemId, i.name, i.passive_effect FROM world_items wi JOIN items i ON i.id = wi.item_id WHERE wi.room_id = ?'
  ).all(roomId)
}
