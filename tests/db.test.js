import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDb, getDb } from '../server/db.js'

const TEST_DB = ':memory:'

describe('db', () => {
  let db

  beforeEach(() => { db = initDb(TEST_DB) })
  afterEach(() => { db.close() })

  it('creates players table', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='players'").get()
    expect(row).toBeTruthy()
  })

  it('creates unlocked_areas table', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='unlocked_areas'").get()
    expect(row).toBeTruthy()
  })

  it('creates discovered_secrets table', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='discovered_secrets'").get()
    expect(row).toBeTruthy()
  })

  it('seeds items catalog', () => {
    const items = db.prepare('SELECT * FROM items').all()
    expect(items.length).toBeGreaterThan(0)
  })

  it('seeds cosmetics catalog', () => {
    const cosmetics = db.prepare('SELECT * FROM cosmetics').all()
    expect(cosmetics.length).toBeGreaterThan(0)
  })
})
