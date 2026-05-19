# Jumper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship a browser-based isometric MMO where anonymous players jump around a shared world, discover hidden mechanics, collect items, and unlock areas.

**Architecture:** Node/Express server with Socket.io handles real-time position sync and is the authority for all game state. SQLite persists player profiles. Phaser 3 renders an isometric world using manual coordinate transforms (no external iso plugin needed). Vite bundles the client.

**Tech Stack:** Node.js (ESM), Express 4, Socket.io 4, better-sqlite3, uuid, Phaser 3, Vite 5, Vitest

---

## File Map

```
jumper/
├── server/
│   ├── index.js          ← Express app + Socket.io mount + static serve
│   ├── db.js             ← SQLite init, schema creation, seed data
│   ├── auth.js           ← Token generation, getOrCreateProfile()
│   ├── profile.js        ← Profile read, skill_level recompute
│   ├── rooms.js          ← Socket.io room join/leave, 20-tick broadcast loop
│   ├── items.js          ← Item pickup / drop / use (server authority)
│   └── secrets.js        ← Secret trigger table + checkDiscovery()
├── client/
│   ├── index.html        ← Vite entry point
│   └── src/
│       ├── main.js       ← Phaser game config, scene list
│       ├── net.js        ← Socket.io client wrapper (singleton)
│       ├── iso.js        ← toScreen(), toWorld(), paintOrder()
│       ├── IsoMap.js     ← Tile map: render tiles in painter's order
│       ├── Player.js     ← Local player: input, iso physics, jump
│       ├── RemotePlayer.js ← Other players: interpolate between ticks
│       └── scenes/
│           ├── Boot.js       ← Token check, auth handshake, load assets
│           └── WorldScene.js ← Shared scene for overworld + rooms
├── shared/
│   └── constants.js      ← TICK_MS, TILE_W/H, room caps, item effects, move speed
├── tests/
│   ├── auth.test.js
│   ├── items.test.js
│   └── secrets.test.js
├── package.json
└── vite.config.js
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `shared/constants.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "jumper",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev:server": "node --watch server/index.js",
    "dev:client": "vite",
    "build": "vite build",
    "test": "vitest run",
    "start": "NODE_ENV=production node server/index.js"
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "express": "^4.19.2",
    "phaser": "^3.80.1",
    "socket.io": "^4.7.5",
    "socket.io-client": "^4.7.5",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "vite": "^5.2.8",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'client',
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/api': 'http://localhost:3000',
    },
  },
})
```

- [ ] **Step 4: Create shared/constants.js**

```js
export const TICK_MS = 50             // 20 ticks/sec
export const TILE_W = 64
export const TILE_H = 32
export const MOVE_SPEED = 4           // tiles per second
export const JUMP_VELOCITY = 0.4      // tiles/tick upward
export const GRAVITY = 0.03           // tiles/tick² downward
export const ROOM_CAP_SMALL = 6
export const ROOM_CAP_DUNGEON = 50

export const ITEM_EFFECTS = {
  floaty_jump:    { gravity: 0.015 },   // half gravity while held
  high_jump:      { jumpVelocity: 0.7 },
  reveal_hidden:  { revealHidden: true },
}

export const SOCKET_EVENTS = {
  AUTH:          'auth',
  AUTH_OK:       'auth:ok',
  JOIN_ROOM:     'join:room',
  JOIN_OK:       'join:ok',
  ROOM_DENIED:   'room:denied',
  MOVE:          'move',
  TICK:          'tick',
  ITEM_PICKUP:   'item:pickup',
  ITEM_DROP:     'item:drop',
  ITEM_USE:      'item:use',
  ITEM_STATE:    'item:state',
  DISCOVER:      'discover',
  DISCOVER_OK:   'discover:ok',
}
```

- [ ] **Step 5: Create directory structure**

```bash
mkdir -p server client/src/scenes shared tests
touch client/index.html
```

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.js shared/constants.js client/index.html
git commit -m "feat: project scaffold, deps, shared constants"
```

---

## Task 2: Database Setup

**Files:**
- Create: `server/db.js`

- [ ] **Step 1: Write the failing test for schema**

Create `tests/db.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDb, getDb } from '../server/db.js'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'

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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/db.test.js
```

Expected: FAIL — `Cannot find module '../server/db.js'`

- [ ] **Step 3: Create server/db.js**

```js
import Database from 'better-sqlite3'

let _db = null

export function initDb(path = './jumper.db') {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      token       TEXT    UNIQUE NOT NULL,
      cosmetic_id INTEGER NOT NULL DEFAULT 1,
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
    insert.run('default',      'none')
    insert.run('sky_blue',     'dungeon_sky')
    insert.run('deep_crimson', 'dungeon_deep')
    insert.run('ghost_white',  'secret_wall_crack')
  }

  _db = db
  return db
}

export function getDb() {
  if (!_db) throw new Error('DB not initialised — call initDb() first')
  return _db
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/db.test.js
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add server/db.js tests/db.test.js
git commit -m "feat: SQLite schema, seed items and cosmetics"
```

---

## Task 3: Auth Module

**Files:**
- Create: `server/auth.js`
- Test: `tests/auth.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/auth.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/auth.test.js
```

Expected: FAIL — `Cannot find module '../server/auth.js'`

- [ ] **Step 3: Create server/auth.js**

```js
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
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/auth.test.js
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add server/auth.js tests/auth.test.js
git commit -m "feat: token auth, getOrCreateProfile"
```

---

## Task 4: Profile Module

**Files:**
- Create: `server/profile.js`

- [ ] **Step 1: Create server/profile.js**

This module is read-only on the REST layer; mutations happen inside `items.js` and `secrets.js`.

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add server/profile.js
git commit -m "feat: profile read + skill_level recompute"
```

---

## Task 5: Items Server Logic

**Files:**
- Create: `server/items.js`
- Test: `tests/items.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/items.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/items.test.js
```

Expected: FAIL — `Cannot find module '../server/items.js'`

- [ ] **Step 3: Add world_items table to db.js**

In `server/db.js`, add to the `db.exec(...)` block after the cosmetics table:

```js
    CREATE TABLE IF NOT EXISTS world_items (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id),
      room_id TEXT    NOT NULL,
      wx      REAL    NOT NULL,
      wy      REAL    NOT NULL,
      wz      REAL    NOT NULL DEFAULT 0
    );
```

- [ ] **Step 4: Create server/items.js**

```js
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
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/items.test.js
```

Expected: PASS — 4 tests passing

- [ ] **Step 6: Re-run db tests to confirm no regression**

```bash
npm test -- tests/db.test.js
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/db.js server/items.js tests/items.test.js
git commit -m "feat: world_items table, item pickup/drop/use server logic"
```

---

## Task 6: Secrets System

**Files:**
- Create: `server/secrets.js`
- Test: `tests/secrets.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/secrets.test.js`:

```js
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
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/secrets.test.js
```

Expected: FAIL — `Cannot find module '../server/secrets.js'`

- [ ] **Step 3: Create server/secrets.js**

```js
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
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/secrets.test.js
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
git add server/secrets.js tests/secrets.test.js
git commit -m "feat: secret trigger system, discovery recording"
```

---

## Task 7: Server Entry + REST API

**Files:**
- Create: `server/rooms.js` (skeleton — filled in Task 11)
- Create: `server/index.js`

- [ ] **Step 1: Create server/rooms.js skeleton**

```js
// Filled in Task 11. Exported here so index.js can import without breaking.
export function attachRooms(_io, _db) {}
```

- [ ] **Step 2: Create server/index.js**

```js
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { initDb } from './db.js'
import { generateToken, getOrCreateProfile } from './auth.js'
import { getProfile } from './profile.js'
import { attachRooms } from './rooms.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const isProd = process.env.NODE_ENV === 'production'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })
const db = initDb()

app.use(express.json())

if (isProd) {
  app.use(express.static(join(__dirname, '../dist')))
}

// Token handshake — called by client on load
app.post('/api/auth', (req, res) => {
  const token = req.body.token || generateToken()
  const profile = getOrCreateProfile(db, token)
  const full = getProfile(db, profile.id)
  res.json({ token, profile: full })
})

attachRooms(io, db)

httpServer.listen(PORT, () => {
  console.log(`Jumper server on http://localhost:${PORT}`)
})
```

- [ ] **Step 3: Start the server and verify it responds**

```bash
npm run dev:server
```

In a second terminal:
```bash
curl -s -X POST http://localhost:3000/api/auth -H 'Content-Type: application/json' -d '{}' | head -c 200
```

Expected output: JSON with `token` and `profile` fields, `profile.skill_level: 0`

- [ ] **Step 4: Commit**

```bash
git add server/index.js server/rooms.js
git commit -m "feat: Express server, /api/auth endpoint"
```

---

## Task 8: Client Entry + Boot Scene

**Files:**
- Modify: `client/index.html`
- Create: `client/src/main.js`
- Create: `client/src/net.js`
- Create: `client/src/scenes/Boot.js`

- [ ] **Step 1: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jumper</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create client/src/net.js**

```js
import { io } from 'socket.io-client'

let _socket = null

export function getSocket() {
  if (!_socket) _socket = io()
  return _socket
}

export async function authenticate() {
  const stored = localStorage.getItem('jumper_token')
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: stored }),
  })
  const { token, profile } = await res.json()
  localStorage.setItem('jumper_token', token)
  return { token, profile }
}
```

- [ ] **Step 3: Create client/src/scenes/Boot.js**

```js
import Phaser from 'phaser'
import { authenticate } from '../net.js'
import { SOCKET_EVENTS } from '../../../shared/constants.js'
import { getSocket } from '../net.js'

export class Boot extends Phaser.Scene {
  constructor() { super('Boot') }

  async create() {
    const text = this.add.text(
      this.scale.width / 2, this.scale.height / 2,
      'connecting...', { color: '#ffffff', fontSize: '18px' }
    ).setOrigin(0.5)

    const { token, profile } = await authenticate()
    const socket = getSocket()

    socket.emit(SOCKET_EVENTS.AUTH, { token })
    socket.once(SOCKET_EVENTS.AUTH_OK, ({ playerId }) => {
      this.scene.start('WorldScene', { playerId, profile, roomId: 'overworld' })
    })
  }
}
```

- [ ] **Step 4: Create client/src/main.js**

```js
import Phaser from 'phaser'
import { Boot } from './scenes/Boot.js'

// WorldScene placeholder until Task 10
class WorldScene extends Phaser.Scene {
  constructor() { super('WorldScene') }
  create(data) {
    this.add.text(20, 20, `playerId: ${data.playerId}`, { color: '#0f0', fontSize: '14px' })
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  scene: [Boot, WorldScene],
})
```

- [ ] **Step 5: Start both dev servers and verify Boot loads**

Terminal 1:
```bash
npm run dev:server
```

Terminal 2:
```bash
npm run dev:client
```

Open `http://localhost:5173` — browser should briefly show "connecting...", then `playerId: undefined` (AUTH_OK not yet wired server-side — that's fine, Boot works and auth fetch succeeds).

Check Network tab: `/api/auth` returns 200 with token + profile.

- [ ] **Step 6: Commit**

```bash
git add client/index.html client/src/main.js client/src/net.js client/src/scenes/Boot.js
git commit -m "feat: Phaser boot, client auth handshake"
```

---

## Task 9: Isometric Math

**Files:**
- Create: `client/src/iso.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/iso.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { toScreen, toWorld, paintOrder } from '../client/src/iso.js'

// TILE_W=64, TILE_H=32. ORIGIN assumed (0,0) for math tests.
describe('iso', () => {
  it('toScreen: tile (0,0,0) maps to (0,0)', () => {
    const s = toScreen(0, 0, 0, 0, 0)
    expect(s.x).toBe(0)
    expect(s.y).toBe(0)
  })

  it('toScreen: tile (1,0,0) maps to (32, 16)', () => {
    const s = toScreen(1, 0, 0, 0, 0)
    expect(s.x).toBe(32)
    expect(s.y).toBe(16)
  })

  it('toScreen: tile (0,1,0) maps to (-32, 16)', () => {
    const s = toScreen(0, 1, 0, 0, 0)
    expect(s.x).toBe(-32)
    expect(s.y).toBe(16)
  })

  it('toScreen: z=1 raises screenY by TILE_H (32)', () => {
    const ground = toScreen(0, 0, 0, 0, 0)
    const raised = toScreen(0, 0, 1, 0, 0)
    expect(raised.y).toBe(ground.y - 32)
  })

  it('toWorld: round-trips toScreen at z=0', () => {
    const w = toWorld(32, 16, 0, 0)
    expect(Math.round(w.tx)).toBe(1)
    expect(Math.round(w.ty)).toBe(0)
  })

  it('paintOrder: lower tx+ty sorts first', () => {
    const tiles = [
      { tx: 2, ty: 2 }, { tx: 0, ty: 0 }, { tx: 1, ty: 0 },
    ]
    const sorted = paintOrder(tiles)
    expect(sorted[0]).toEqual({ tx: 0, ty: 0 })
    expect(sorted[2]).toEqual({ tx: 2, ty: 2 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/iso.test.js
```

Expected: FAIL — `Cannot find module '../client/src/iso.js'`

- [ ] **Step 3: Create client/src/iso.js**

```js
import { TILE_W, TILE_H } from '../../shared/constants.js'

const HW = TILE_W / 2   // 32
const HH = TILE_H / 2   // 16

export function toScreen(tx, ty, tz, originX, originY) {
  return {
    x: (tx - ty) * HW + originX,
    y: (tx + ty) * HH - tz * TILE_H + originY,
  }
}

export function toWorld(screenX, screenY, originX, originY) {
  const sx = screenX - originX
  const sy = screenY - originY
  return {
    tx: (sx / HW + sy / HH) / 2,
    ty: (sy / HH - sx / HW) / 2,
  }
}

// Sort an array of objects with tx/ty properties back-to-front for painter's order
export function paintOrder(tiles) {
  return [...tiles].sort((a, b) => (a.tx + a.ty) - (b.tx + b.ty))
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/iso.test.js
```

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add client/src/iso.js tests/iso.test.js
git commit -m "feat: isometric coordinate math, toScreen/toWorld/paintOrder"
```

---

## Task 10: Tile Map Rendering

**Files:**
- Create: `client/src/IsoMap.js`

- [ ] **Step 1: Create client/src/IsoMap.js**

IsoMap takes a 2D grid and renders tiles as colored rectangles in painter's order. No art assets needed yet — tiles are solid colors.

```js
import { toScreen, paintOrder } from './iso.js'
import { TILE_W, TILE_H } from '../../shared/constants.js'

// Tile type definitions: id → fill color (hex number)
const TILE_COLORS = {
  0: null,         // air — not rendered
  1: 0x4a7c59,    // ground
  2: 0x8b5e3c,    // wall
  3: 0x2a4a6b,    // water
}

export class IsoMap {
  /**
   * @param {Phaser.Scene} scene
   * @param {number[][]} grid  - 2D array of tile type ids
   * @param {number} originX  - screen X for world (0,0)
   * @param {number} originY  - screen Y for world (0,0)
   */
  constructor(scene, grid, originX, originY) {
    this.scene = scene
    this.grid = grid
    this.originX = originX
    this.originY = originY
    this._graphics = scene.add.graphics()
    this.draw()
  }

  draw() {
    const g = this._graphics
    g.clear()

    // Build flat list with tx/ty for sorting
    const tiles = []
    for (let ty = 0; ty < this.grid.length; ty++) {
      for (let tx = 0; tx < this.grid[ty].length; tx++) {
        const type = this.grid[ty][tx]
        if (type !== 0) tiles.push({ tx, ty, type })
      }
    }

    for (const tile of paintOrder(tiles)) {
      const color = TILE_COLORS[tile.type]
      if (color === null) continue
      const { x, y } = toScreen(tile.tx, tile.ty, 0, this.originX, this.originY)
      this._drawTile(g, x, y, color)
    }
  }

  _drawTile(g, sx, sy, color) {
    const hw = TILE_W / 2
    const hh = TILE_H / 2
    g.fillStyle(color, 1)
    g.fillPoints([
      { x: sx,      y: sy - hh },   // top
      { x: sx + hw, y: sy },        // right
      { x: sx,      y: sy + hh },   // bottom
      { x: sx - hw, y: sy },        // left
    ], true)
    // Darker outline
    g.lineStyle(1, 0x000000, 0.3)
    g.strokePoints([
      { x: sx,      y: sy - hh },
      { x: sx + hw, y: sy },
      { x: sx,      y: sy + hh },
      { x: sx - hw, y: sy },
    ], true)
  }
}
```

- [ ] **Step 2: Replace WorldScene placeholder in client/src/main.js**

Replace the entire `WorldScene` class in `main.js` with:

```js
import { WorldScene } from './scenes/WorldScene.js'
```

And replace the import list:

```js
import Phaser from 'phaser'
import { Boot } from './scenes/Boot.js'
import { WorldScene } from './scenes/WorldScene.js'

new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  scene: [Boot, WorldScene],
})
```

- [ ] **Step 3: Create client/src/scenes/WorldScene.js (map only for now)**

```js
import Phaser from 'phaser'
import { IsoMap } from '../IsoMap.js'

// Simple 16x16 overworld — 1=ground, 2=wall, 0=air
const OVERWORLD_GRID = Array.from({ length: 16 }, (_, ty) =>
  Array.from({ length: 16 }, (_, tx) => {
    if (tx === 0 || tx === 15 || ty === 0 || ty === 15) return 2   // border walls
    return 1
  })
)

export class WorldScene extends Phaser.Scene {
  constructor() { super('WorldScene') }

  create(data) {
    this.playerId = data?.playerId
    this.profile  = data?.profile
    this.roomId   = data?.roomId ?? 'overworld'

    const originX = this.scale.width / 2
    const originY = 80

    this.isoMap = new IsoMap(this, OVERWORLD_GRID, originX, originY)
  }
}
```

- [ ] **Step 4: Verify the map renders**

With both dev servers running, open `http://localhost:5173`. You should see an isometric diamond grid of green tiles with brown border walls. Boot will show "connecting..." briefly before transitioning to WorldScene.

- [ ] **Step 5: Commit**

```bash
git add client/src/IsoMap.js client/src/scenes/WorldScene.js client/src/main.js
git commit -m "feat: isometric tile map rendering, WorldScene base"
```

---

## Task 11: Local Player Movement

**Files:**
- Create: `client/src/Player.js`
- Modify: `client/src/scenes/WorldScene.js`

- [ ] **Step 1: Create client/src/Player.js**

```js
import Phaser from 'phaser'
import { toScreen } from './iso.js'
import { TILE_W, TILE_H, MOVE_SPEED, JUMP_VELOCITY, GRAVITY, ITEM_EFFECTS } from '../../shared/constants.js'

export class Player {
  constructor(scene, tx, ty, profile) {
    this.scene   = scene
    this.tx      = tx
    this.ty      = ty
    this.tz      = 0
    this.vz      = 0          // vertical velocity (jump)
    this.onGround = true
    this.profile  = profile
    this.heldItem = profile?.heldItem ?? null
    this.facing   = 'se'

    const g = scene.add.graphics()
    this._drawShape(g)
    this.gfx = g
  }

  _drawShape(g) {
    g.clear()
    g.fillStyle(0x89b4fa, 1)
    g.fillRect(-8, -20, 16, 20)
  }

  get passiveEffect() {
    if (!this.heldItem) return {}
    return ITEM_EFFECTS[this.heldItem.passive_effect] ?? {}
  }

  update(dt, cursors, keys, grid) {
    const speed = MOVE_SPEED * dt
    let dx = 0, dy = 0

    if (cursors.left.isDown  || keys.a.isDown) dx -= speed
    if (cursors.right.isDown || keys.d.isDown) dx += speed
    if (cursors.up.isDown    || keys.w.isDown) dy -= speed
    if (cursors.down.isDown  || keys.s.isDown) dy += speed

    // Diagonal normalisation
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707 }

    const nx = this.tx + dx
    const ny = this.ty + dy
    const cols = grid[0].length
    const rows = grid.length

    if (nx >= 0 && nx < cols && grid[Math.floor(this.ty)]?.[Math.floor(nx)] !== 2) this.tx = nx
    if (ny >= 0 && ny < rows && grid[Math.floor(ny)]?.[Math.floor(this.tx)] !== 2) this.ty = ny

    // Jump
    if (Phaser.Input.Keyboard.JustDown(keys.space) && this.onGround) {
      const jv = this.passiveEffect.jumpVelocity ?? JUMP_VELOCITY
      this.vz = jv
      this.onGround = false
    }

    // Gravity
    const grav = this.passiveEffect.gravity ?? GRAVITY
    if (!this.onGround) {
      this.vz -= grav
      this.tz += this.vz
      if (this.tz <= 0) {
        this.tz = 0
        this.vz = 0
        this.onGround = true
      }
    }

    this._syncPosition()
  }

  _syncPosition() {
    const originX = this.scene.scale.width / 2
    const originY = 80
    const { x, y } = toScreen(this.tx, this.ty, this.tz, originX, originY)
    this.gfx.setPosition(x, y - TILE_H / 2)
  }

  getState() {
    return { x: this.tx, y: this.ty, z: this.tz, facing: this.facing }
  }

  destroy() { this.gfx.destroy() }
}
```

- [ ] **Step 2: Add player to WorldScene**

At the top of `client/src/scenes/WorldScene.js`, add the Player import alongside the existing IsoMap import:

```js
import { Player } from '../Player.js'
```

Then replace the entire `create(data)` method with:
    this.playerId = data?.playerId
    this.profile  = data?.profile
    this.roomId   = data?.roomId ?? 'overworld'

    const originX = this.scale.width / 2
    const originY = 80

    this.isoMap = new IsoMap(this, OVERWORLD_GRID, originX, originY)

    this.player = new Player(this, 8, 8, this.profile)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      e: Phaser.Input.Keyboard.KeyCodes.E,   // use item
      q: Phaser.Input.Keyboard.KeyCodes.Q,   // drop item
    })
  }

  update(_time, delta) {
    const dt = delta / 1000
    this.player.update(dt, this.cursors, this.keys, OVERWORLD_GRID)
  }
}
```

- [ ] **Step 3: Verify movement in browser**

Open `http://localhost:5173`. You should see a blue rectangle on the isometric grid. WASD/arrows move it along the grid. Space makes it jump (arc upward and land). The player should be blocked by wall tiles at the border.

- [ ] **Step 4: Commit**

```bash
git add client/src/Player.js client/src/scenes/WorldScene.js
git commit -m "feat: local player movement, jump physics, iso position"
```

---

## Task 12: Socket.io Rooms + Position Sync

**Files:**
- Modify: `server/rooms.js` (replace skeleton)
- Modify: `client/src/scenes/WorldScene.js`
- Create: `client/src/RemotePlayer.js`

- [ ] **Step 1: Replace server/rooms.js**

```js
import { getOrCreateProfile } from './auth.js'
import { getProfile } from './profile.js'
import { getWorldItems, pickupItem, dropItem, useItem } from './items.js'
import { checkDiscovery } from './secrets.js'
import { TICK_MS, ROOM_CAP_SMALL, SOCKET_EVENTS as E } from '../shared/constants.js'

const S = E  // alias for brevity

export function attachRooms(io, db) {
  // playerId → { socket, roomId, x, y, z, facing, cosmeticId }
  const players = new Map()

  io.on('connection', socket => {
    let playerId = null

    socket.on(S.AUTH, ({ token }) => {
      const profile = getOrCreateProfile(db, token)
      playerId = profile.id
      const full = getProfile(db, playerId)
      players.set(playerId, { socket, roomId: null, x: 8, y: 8, z: 0, facing: 'se', cosmeticId: profile.cosmetic_id })
      socket.emit(S.AUTH_OK, { playerId, profile: full })
    })

    socket.on(S.JOIN_ROOM, ({ roomId }) => {
      if (!playerId) return
      const state = players.get(playerId)

      // Check room caps
      const roomSize = [...players.values()].filter(p => p.roomId === roomId).length
      if (roomId.startsWith('small_') && roomSize >= ROOM_CAP_SMALL) {
        return socket.emit(S.ROOM_DENIED, { reason: 'full' })
      }

      // Check skill gating
      const profile = db.prepare('SELECT skill_level FROM players WHERE id = ?').get(playerId)
      const MIN_SKILL = { dungeon_deep: 2, dungeon_sky: 1 }
      if (MIN_SKILL[roomId] && profile.skill_level < MIN_SKILL[roomId]) {
        return socket.emit(S.ROOM_DENIED, { reason: 'skill_level' })
      }

      if (state.roomId) socket.leave(state.roomId)
      state.roomId = roomId
      socket.join(roomId)

      const roomPlayers = [...players.entries()]
        .filter(([, p]) => p.roomId === roomId)
        .map(([id, p]) => ({ id, x: p.x, y: p.y, z: p.z, cosmeticId: p.cosmeticId }))

      socket.emit(S.JOIN_OK, {
        players: roomPlayers,
        worldItems: getWorldItems(db, roomId),
      })
    })

    socket.on(S.MOVE, ({ x, y, z, facing }) => {
      if (!playerId) return
      const state = players.get(playerId)
      state.x = x; state.y = y; state.z = z; state.facing = facing
    })

    socket.on(S.ITEM_PICKUP, ({ worldItemId }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = pickupItem(db, playerId, worldItemId)
      if (!result.ok) return
      io.to(state.roomId).emit(S.ITEM_STATE, { worldItems: getWorldItems(db, state.roomId) })
    })

    socket.on(S.ITEM_DROP, ({ x, y, z }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = dropItem(db, playerId, x, y, z, state.roomId)
      if (!result.ok) return
      io.to(state.roomId).emit(S.ITEM_STATE, { worldItems: getWorldItems(db, state.roomId) })
    })

    socket.on(S.ITEM_USE, ({ triggerId }) => {
      if (!playerId) return
      const result = useItem(db, playerId, triggerId)
      if (!result.ok) return
      // Trigger-specific world effects would fire here
    })

    socket.on(S.DISCOVER, ({ action, wx, wy, wz, itemId }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = checkDiscovery(db, playerId, { action, roomId: state.roomId, wx, wy, wz, itemId })
      if (result) socket.emit(S.DISCOVER_OK, result)
    })

    socket.on('disconnect', () => {
      if (playerId) players.delete(playerId)
    })
  })

  // 20 ticks/sec broadcast
  setInterval(() => {
    // Group by room and broadcast each room's players
    const byRoom = new Map()
    for (const [id, p] of players) {
      if (!p.roomId) continue
      if (!byRoom.has(p.roomId)) byRoom.set(p.roomId, [])
      byRoom.get(p.roomId).push({ id, x: p.x, y: p.y, z: p.z, facing: p.facing, cosmeticId: p.cosmeticId })
    }
    for (const [roomId, playerList] of byRoom) {
      io.to(roomId).emit(S.TICK, { players: playerList })
    }
  }, TICK_MS)
}
```

- [ ] **Step 2: Create client/src/RemotePlayer.js**

```js
import { toScreen } from './iso.js'
import { TILE_H } from '../../shared/constants.js'

export class RemotePlayer {
  constructor(scene, id, x, y, z) {
    this.id = id
    this.tx = x; this.ty = y; this.tz = z
    this._targetX = x; this._targetY = y; this._targetZ = z
    this.scene = scene

    const g = scene.add.graphics()
    g.fillStyle(0xf38ba8, 1)
    g.fillRect(-8, -20, 16, 20)
    this.gfx = g
    this._syncPosition()
  }

  updateTarget(x, y, z) {
    this._targetX = x; this._targetY = y; this._targetZ = z
  }

  update() {
    const alpha = 0.3  // lerp factor — smooth interpolation between ticks
    this.tx += (this._targetX - this.tx) * alpha
    this.ty += (this._targetY - this.ty) * alpha
    this.tz += (this._targetZ - this.tz) * alpha
    this._syncPosition()
  }

  _syncPosition() {
    const originX = this.scene.scale.width / 2
    const originY = 80
    const { x, y } = toScreen(this.tx, this.ty, this.tz, originX, originY)
    this.gfx.setPosition(x, y - TILE_H / 2)
  }

  destroy() { this.gfx.destroy() }
}
```

- [ ] **Step 3: Wire up Socket.io in WorldScene**

Add the following to `client/src/scenes/WorldScene.js`:

At the top, add imports:
```js
import { getSocket } from '../net.js'
import { RemotePlayer } from '../RemotePlayer.js'
import { SOCKET_EVENTS as E } from '../../../shared/constants.js'
```

At the end of `create()`, add:
```js
    // Multiplayer setup
    this.remotePlayers = new Map()
    const socket = getSocket()

    socket.emit(E.JOIN_ROOM, { roomId: this.roomId })

    socket.on(E.JOIN_OK, ({ players }) => {
      for (const p of players) {
        if (p.id === this.playerId) continue
        this.remotePlayers.set(p.id, new RemotePlayer(this, p.id, p.x, p.y, p.z))
      }
    })

    socket.on(E.TICK, ({ players }) => {
      const seen = new Set()
      for (const p of players) {
        if (p.id === this.playerId) continue
        seen.add(p.id)
        if (this.remotePlayers.has(p.id)) {
          this.remotePlayers.get(p.id).updateTarget(p.x, p.y, p.z)
        } else {
          this.remotePlayers.set(p.id, new RemotePlayer(this, p.id, p.x, p.y, p.z))
        }
      }
      // Remove disconnected players
      for (const [id, rp] of this.remotePlayers) {
        if (!seen.has(id)) { rp.destroy(); this.remotePlayers.delete(id) }
      }
    })

    // Send position every update
    this._lastSent = { x: 8, y: 8, z: 0 }
    this._socket = socket
```

At the end of `update()`, add:
```js
    // Send position to server
    const state = this.player.getState()
    this._socket.emit(E.MOVE, state)

    // Interpolate remote players
    for (const rp of this.remotePlayers.values()) rp.update()
```

- [ ] **Step 4: Test multiplayer — open two browser tabs**

Open `http://localhost:5173` in two tabs. Move the player in one — you should see a pink rectangle representing the other player in both windows, moving smoothly. Join/leave is handled on disconnect.

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js client/src/RemotePlayer.js client/src/scenes/WorldScene.js
git commit -m "feat: Socket.io rooms, position broadcast at 20hz, remote player interpolation"
```

---

## Task 13: Item Pickup and Drop (Client)

**Files:**
- Modify: `client/src/scenes/WorldScene.js`

- [ ] **Step 1: Add world items rendering and interaction to WorldScene**

Add to the top of `WorldScene.js`:
```js
import { SOCKET_EVENTS as E, TILE_W, TILE_H } from '../../../shared/constants.js'
```

Add `_worldItemGfx` map to track item graphics. In `create()`, after `this._socket = socket`, add:

```js
    this._worldItemGfx = new Map()

    socket.on(E.ITEM_STATE, ({ worldItems }) => {
      this._renderWorldItems(worldItems)
    })

    // Q = drop held item
    this.input.keyboard.on('keydown-Q', () => {
      const state = this.player.getState()
      this._socket.emit(E.ITEM_DROP, { x: state.x, y: state.y, z: state.z })
    })

    // Walk over an item to pick it up — checked in update
```

Add to `WorldScene`:
```js
  _renderWorldItems(worldItems) {
    // Clear old
    for (const g of this._worldItemGfx.values()) g.destroy()
    this._worldItemGfx.clear()

    const originX = this.scale.width / 2
    const originY = 80

    for (const item of worldItems) {
      const { x, y } = toScreen(item.wx, item.wy, item.wz, originX, originY)
      const g = this.add.graphics()
      g.fillStyle(0xfab387, 1)
      g.fillCircle(0, 0, 6)
      g.setPosition(x, y)
      this._worldItemGfx.set(item.worldItemId, g)
      g._worldItemId = item.worldItemId
      g._wx = item.wx
      g._wy = item.wy
    }
  }
```

Add pickup proximity check to `update()`, before sending position:
```js
    // Pickup: if player is within 1 tile of a world item and has empty hands, auto-pickup
    if (!this.profile?.heldItem) {
      for (const [worldItemId, g] of this._worldItemGfx) {
        const dx = Math.abs(this.player.tx - g._wx)
        const dy = Math.abs(this.player.ty - g._wy)
        if (dx < 0.8 && dy < 0.8) {
          this._socket.emit(E.ITEM_PICKUP, { worldItemId })
          break
        }
      }
    }
```

- [ ] **Step 2: Add iso.js import to WorldScene**

At the top of WorldScene.js, ensure this import is present:
```js
import { toScreen } from '../iso.js'
```

- [ ] **Step 3: Verify in browser**

Start fresh. Walk over the location where a world item would be spawned. In a real test you'll need to manually insert a world item via sqlite3 CLI:

```bash
sqlite3 jumper.db "INSERT INTO world_items (item_id, room_id, wx, wy, wz) VALUES (1, 'overworld', 8, 10, 0)"
```

Reload the page — an orange dot should appear on the map at (8,10). Walk toward it — it disappears (picked up). Press Q — a new dot appears at your current position.

- [ ] **Step 4: Commit**

```bash
git add client/src/scenes/WorldScene.js
git commit -m "feat: world item rendering, auto-pickup on proximity, Q to drop"
```

---

## Task 14: Discovery Client Flow

**Files:**
- Modify: `client/src/Player.js`
- Modify: `client/src/scenes/WorldScene.js`

- [ ] **Step 1: Add discovery emit to Player.js**

Add a callback hook to `Player` so it can signal discovery events without depending on Socket.io directly. At the bottom of `update()` in `Player.js`, after movement resolves:

```js
    // Emit discovery attempt on jump or dive
    if (Phaser.Input.Keyboard.JustDown(keys.space) && this.onGround) {
      this.onDiscoverAttempt?.({
        action: 'jump',
        wx: Math.floor(this.tx),
        wy: Math.floor(this.ty),
        wz: Math.floor(this.tz),
        itemId: this.heldItem?.id ?? null,
      })
    }
    if (cursors.down.isDown && !this.onGround) {
      this.onDiscoverAttempt?.({
        action: 'dive',
        wx: Math.floor(this.tx),
        wy: Math.floor(this.ty),
        wz: Math.floor(this.tz),
        itemId: this.heldItem?.id ?? null,
      })
    }
    if (dx !== 0 || dy !== 0) {
      this.onDiscoverAttempt?.({
        action: 'move',
        wx: Math.floor(this.tx),
        wy: Math.floor(this.ty),
        wz: 0,
        itemId: this.heldItem?.id ?? null,
      })
    }
```

- [ ] **Step 2: Wire discovery in WorldScene**

In `create()` of `WorldScene.js`, after creating `this.player`, add:

```js
    this.player.onDiscoverAttempt = (payload) => {
      this._socket.emit(E.DISCOVER, payload)
    }

    socket.on(E.DISCOVER_OK, ({ secretId, effect }) => {
      console.log('Discovery:', secretId, effect)
      this._showDiscoveryFlash(secretId)
      if (this.profile) {
        this.profile.discoveredSecrets = [...(this.profile.discoveredSecrets ?? []), secretId]
      }
    })
```

Add to `WorldScene`:
```js
  _showDiscoveryFlash(secretId) {
    const text = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2 - 60,
      '✦ discovered',
      { color: '#a6e3a1', fontSize: '22px', fontStyle: 'bold' }
    ).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: text,
      alpha: { from: 1, to: 0 },
      y: '-=40',
      duration: 2000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }
```

- [ ] **Step 3: Verify discovery flow**

Walk to tile (6, 6) in the overworld (center-ish of the 16×16 map) and press Space. Check the browser console — you should see `Discovery: secret_wall_crack { type: 'cosmetic', value: 'ghost_white' }` and a fade-out "✦ discovered" message on screen.

Check the database:
```bash
sqlite3 jumper.db "SELECT * FROM discovered_secrets"
```

Expected: one row with your player_id and `secret_wall_crack`.

- [ ] **Step 4: Commit**

```bash
git add client/src/Player.js client/src/scenes/WorldScene.js
git commit -m "feat: discovery emit on jump/move/dive, server validation, flash UI"
```

---

## Task 15: Production Build + Smoke Test

**Files:**
- Modify: `server/index.js` (already handles prod static serve)

- [ ] **Step 1: Build the client**

```bash
npm run build
```

Expected: `dist/` directory created with `index.html` and assets.

- [ ] **Step 2: Start in production mode**

```bash
npm start
```

Open `http://localhost:3000`. The game should load from the built files — no Vite dev server needed.

- [ ] **Step 3: Run all tests one final time**

```bash
npm test
```

Expected: all tests pass (db, auth, items, secrets, iso — roughly 22 tests total)

- [ ] **Step 4: Commit**

```bash
git add dist/ -f   # dist is normally gitignored — add it only if you want to ship it
git commit -m "chore: production build, smoke test confirmed"
```

*Note: Add `dist/` to `.gitignore` if you plan to build on the server rather than commit it.*

- [ ] **Step 5: Push to origin**

```bash
git push origin master
```

---

## What's Playable After This Plan

- Anonymous players join via browser, get a persistent profile
- Isometric 16×16 overworld rendered in painter's order
- WASD/arrows to move, Space to jump with physics and passive item modifiers
- Multiple players visible simultaneously with smooth interpolation
- Items appear in the world, auto-pickup on proximity, Q to drop
- Jump at tile (6,6) to trigger the first secret discovery — "✦ discovered" flash, cosmetic unlocked
- Walk with Feather item to area (10–13, 3–6) to unlock dungeon_sky
- Dive at area (0–3, 10–13) to unlock dungeon_deep (dungeon entry gating is enforced server-side on `join:room`)

## What's Not In This Plan (Next Steps)

- Actual dungeon scenes / room transition
- Cosmetic visual rendering (shape/color variants per cosmetic_id)
- Bounce-off-others discovery (requires server-side player proximity check)
- Lantern item revealing hidden tiles
- Key + lock door world objects
- Mobile / touch input
