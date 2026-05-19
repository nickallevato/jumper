import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDb } from '../server/db.js'
import { generateToken, getOrCreateProfile } from '../server/auth.js'

describe('auth', () => {
  let db

  beforeEach(() => { db = initDb(':memory:') })
  afterEach(() => { db.close() })

  it('generateToken returns a non-empty string', () => {
    const t = generateToken()
    expect(typeof t).toBe('string')
    expect(t.length).toBeGreaterThan(0)
  })

  it('generateToken returns unique values', () => {
    expect(generateToken()).not.toBe(generateToken())
  })

  it('getOrCreateProfile creates a new player for unknown token', () => {
    const profile = getOrCreateProfile(db, 'tok-abc')
    expect(profile.id).toBeGreaterThan(0)
    expect(profile.token).toBe('tok-abc')
    expect(profile.skill_level).toBe(0)
  })

  it('getOrCreateProfile returns same player on second call', () => {
    const a = getOrCreateProfile(db, 'tok-abc')
    const b = getOrCreateProfile(db, 'tok-abc')
    expect(a.id).toBe(b.id)
  })

  it('getOrCreateProfile creates separate players for different tokens', () => {
    const a = getOrCreateProfile(db, 'tok-1')
    const b = getOrCreateProfile(db, 'tok-2')
    expect(a.id).not.toBe(b.id)
  })
})
