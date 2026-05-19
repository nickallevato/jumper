import { v4 as uuidv4 } from 'uuid'

export function generateToken() {
  return uuidv4()
}

export function getOrCreateProfile(db, token) {
  const existing = db.prepare('SELECT * FROM players WHERE token = ?').get(token)
  if (existing) {
    db.prepare("UPDATE players SET last_seen = datetime('now') WHERE id = ?").run(existing.id)
    return existing
  }

  const result = db.prepare(
    "INSERT INTO players (token, cosmetic_id, skill_level, last_seen) VALUES (?, 1, 0, datetime('now'))"
  ).run(token)

  return db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid)
}
