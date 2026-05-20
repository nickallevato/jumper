import Database from 'better-sqlite3'
import { COSMETICS } from '../shared/cosmetics.js'

let _db = null

export function initDb(path = './jumper.db') {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      passive_effect TEXT NOT NULL,
      world_trigger  TEXT
    );

    CREATE TABLE IF NOT EXISTS cosmetics (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      unlock_condition TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS world_items (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id),
      room_id TEXT    NOT NULL,
      wx      REAL    NOT NULL,
      wy      REAL    NOT NULL,
      wz      REAL    NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS players (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      token       TEXT    UNIQUE NOT NULL,
      cosmetic_id INTEGER NOT NULL DEFAULT 1 REFERENCES cosmetics(id),
      held_item_id INTEGER REFERENCES items(id),
      skill_level INTEGER NOT NULL DEFAULT 0,
      last_seen   DATETIME,
      created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS unlocked_areas (
      player_id  INTEGER NOT NULL REFERENCES players(id),
      area_id    TEXT    NOT NULL,
      unlocked_at DATETIME NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (player_id, area_id)
    );

    CREATE TABLE IF NOT EXISTS discovered_secrets (
      player_id    INTEGER NOT NULL REFERENCES players(id),
      secret_id    TEXT    NOT NULL,
      discovered_at DATETIME NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (player_id, secret_id)
    );
  `)

  const itemCount = db.prepare('SELECT COUNT(*) as n FROM items').get().n
  if (itemCount === 0) {
    const insert = db.prepare('INSERT INTO items (name, passive_effect, world_trigger) VALUES (?, ?, ?)')
    insert.run('Feather', 'floaty_jump',   null)
    insert.run('Spring',  'high_jump',     null)
    insert.run('Lantern', 'reveal_hidden', null)
    insert.run('Key',     'none',          'unlock_door')
  }

  const cosmeticCount = db.prepare('SELECT COUNT(*) as n FROM cosmetics').get().n
  if (cosmeticCount === 0) {
    const insert = db.prepare('INSERT INTO cosmetics (name, unlock_condition) VALUES (?, ?)')
    // Seed in catalog order so DB id matches the shared COSMETICS index (id = index + 1).
    for (const c of COSMETICS) insert.run(c.name, c.unlock)
  }

  _db = db
  return db
}

export function getDb() {
  if (!_db) throw new Error('DB not initialised — call initDb() first')
  return _db
}
