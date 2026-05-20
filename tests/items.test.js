import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDb } from '../server/db.js'
import { getOrCreateProfile } from '../server/auth.js'
import { pickupItem, dropItem, useItem, getWorldItems } from '../server/items.js'

describe('items', () => {
  let db, playerId, featherId

  beforeEach(() => {
    db = initDb(':memory:')
    playerId = getOrCreateProfile(db, 'tok-items').id
    featherId = db.prepare("SELECT id FROM items WHERE name = 'Feather'").get().id

    // Start from an empty world so this suite controls its own fixtures (initDb seeds items).
    db.prepare('DELETE FROM world_items').run()
    db.prepare('INSERT INTO world_items (item_id, room_id, wx, wy, wz) VALUES (?, ?, ?, ?, ?)').run(featherId, 'overworld', 5, 5, 0)
  })

  afterEach(() => { db.close() })

  it('pickupItem gives player the item and removes it from world', () => {
    const worldItemId = db.prepare('SELECT id FROM world_items WHERE item_id = ?').get(featherId).id
    const result = pickupItem(db, playerId, worldItemId)
    expect(result.ok).toBe(true)
    expect(db.prepare('SELECT held_item_id FROM players WHERE id = ?').get(playerId).held_item_id).toBe(featherId)
    expect(db.prepare('SELECT id FROM world_items WHERE id = ?').get(worldItemId)).toBeUndefined()
  })

  it('pickupItem fails if player already holds an item', () => {
    const worldItemId = db.prepare('SELECT id FROM world_items WHERE item_id = ?').get(featherId).id
    pickupItem(db, playerId, worldItemId)

    const springId = db.prepare("SELECT id FROM items WHERE name = 'Spring'").get().id
    db.prepare('INSERT INTO world_items (item_id, room_id, wx, wy, wz) VALUES (?, ?, ?, ?, ?)').run(springId, 'overworld', 6, 6, 0)
    const springWorldId = db.prepare('SELECT id FROM world_items WHERE item_id = ?').get(springId).id

    const result = pickupItem(db, playerId, springWorldId)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('already_holding')
  })

  it('dropItem places item in world and clears held_item_id', () => {
    const worldItemId = db.prepare('SELECT id FROM world_items WHERE item_id = ?').get(featherId).id
    pickupItem(db, playerId, worldItemId)

    const result = dropItem(db, playerId, 10, 10, 0, 'overworld')
    expect(result.ok).toBe(true)
    expect(db.prepare('SELECT held_item_id FROM players WHERE id = ?').get(playerId).held_item_id).toBeNull()
    const worldItem = db.prepare('SELECT * FROM world_items WHERE item_id = ?').get(featherId)
    expect(worldItem).toBeTruthy()
    expect(worldItem.wx).toBe(10)
  })

  it('dropItem fails if player holds nothing', () => {
    const result = dropItem(db, playerId, 10, 10, 0, 'overworld')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not_holding')
  })
})
