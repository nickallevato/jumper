import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDb } from '../server/db.js'
import { getOrCreateProfile } from '../server/auth.js'
import { checkDiscovery } from '../server/secrets.js'

describe('secrets', () => {
  let db, playerId

  beforeEach(() => {
    db = initDb(':memory:')
    playerId = getOrCreateProfile(db, 'tok-secrets').id
  })

  afterEach(() => { db.close() })

  it('returns null when no trigger matches', () => {
    const result = checkDiscovery(db, playerId, {
      action: 'jump', roomId: 'overworld', wx: 99, wy: 99, wz: 0, itemId: null,
    })
    expect(result).toBeNull()
  })

  it('records discovery and returns effect when trigger matches', () => {
    const result = checkDiscovery(db, playerId, {
      action: 'jump', roomId: 'overworld', wx: 6, wy: 6, wz: 0, itemId: null,
    })
    expect(result).not.toBeNull()
    expect(result.secretId).toBe('secret_wall_crack')
    const row = db.prepare('SELECT secret_id FROM discovered_secrets WHERE player_id = ?').get(playerId)
    expect(row.secret_id).toBe('secret_wall_crack')
  })

  it('does not double-record the same secret', () => {
    const trigger = { action: 'jump', roomId: 'overworld', wx: 6, wy: 6, wz: 0, itemId: null }
    checkDiscovery(db, playerId, trigger)
    checkDiscovery(db, playerId, trigger)
    const rows = db.prepare('SELECT * FROM discovered_secrets WHERE player_id = ? AND secret_id = ?').all(playerId, 'secret_wall_crack')
    expect(rows.length).toBe(1)
  })

  it('increments skill_level on first discovery', () => {
    checkDiscovery(db, playerId, {
      action: 'jump', roomId: 'overworld', wx: 6, wy: 6, wz: 0, itemId: null,
    })
    const player = db.prepare('SELECT skill_level FROM players WHERE id = ?').get(playerId)
    expect(player.skill_level).toBe(1)
  })

  // Movement techniques — position-independent triggers
  it.each([
    ['wall_kick',   'secret_wall_kick'],
    ['head_bounce', 'secret_head_bounce'],
    ['pogo',        'secret_pogo'],
  ])('records %s anywhere in the overworld', (action, secretId) => {
    const result = checkDiscovery(db, playerId, {
      action, roomId: 'overworld', wx: 42, wy: 99, wz: 3, itemId: null,
    })
    expect(result).not.toBeNull()
    expect(result.secretId).toBe(secretId)
    const row = db.prepare('SELECT secret_id FROM discovered_secrets WHERE player_id = ? AND secret_id = ?').get(playerId, secretId)
    expect(row.secret_id).toBe(secretId)
  })

  it('does not fire a technique trigger in the wrong room', () => {
    const result = checkDiscovery(db, playerId, {
      action: 'wall_kick', roomId: 'dungeon_sky', wx: 5, wy: 5, wz: 0, itemId: null,
    })
    expect(result).toBeNull()
  })

  it('records secret_counterweight when the goal ledge is reached', () => {
    const result = checkDiscovery(db, playerId, {
      action: 'reach_counterweight', roomId: 'overworld', wx: 8, wy: 11, wz: 2, itemId: null,
    })
    expect(result).not.toBeNull()
    expect(result.secretId).toBe('secret_counterweight')
    expect(result.effect).toEqual({ type: 'cosmetic', value: 'counterweight' })
  })

  it('equips the unlocked cosmetic on a cosmetic-effect discovery', () => {
    checkDiscovery(db, playerId, {
      action: 'reach_counterweight', roomId: 'overworld', wx: 8, wy: 11, wz: 2, itemId: null,
    })
    const player = db.prepare('SELECT cosmetic_id FROM players WHERE id = ?').get(playerId)
    expect(player.cosmetic_id).toBe(8) // counterweight cosmetic
  })
})
