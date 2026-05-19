# Jumper — Design Spec
*2026-05-19*

## Overview

Jumper is a browser-based isometric MMO where anonymous players jump around a shared world, discover hidden movement techniques and secrets, collect and trade items, and unlock new areas through exploration. Simple mechanics combine in emergent ways. The game is designed to be shipped end-to-end as a first complete game project.

---

## Stack

| Layer | Technology |
|---|---|
| Game client | Phaser.js (isometric tile rendering via manual coordinate transform or `phaser3-plugin-isometric`) |
| Real-time sync | Socket.io (client + server) |
| Server | Node.js + Express |
| Persistence | SQLite (via `better-sqlite3`) |
| Hosting | Single Node process, serves static client files |

---

## Identity & Authentication

- No usernames, no passwords, no email.
- On first visit, the server generates a UUID token and returns it. The client stores it in `localStorage`.
- On subsequent visits, the client sends the token; the server loads the matching profile.
- Players are identified in-world purely by their **cosmetic appearance** — color palette + shape variant + accessory. No name tag, no label.
- If a player clears localStorage, they start a fresh profile. This is intentional — losing your token is losing your character.

---

## Data Schema

### `players`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | |
| `token` | TEXT UNIQUE | localStorage identity |
| `cosmetic_id` | INTEGER | current appearance |
| `held_item_id` | INTEGER NULLABLE | FK to items; one item max |
| `skill_level` | INTEGER DEFAULT 0 | derived from discovery count |
| `last_seen` | DATETIME | |
| `created_at` | DATETIME | |

### `unlocked_areas`
| Column | Type | Notes |
|---|---|---|
| `player_id` | INTEGER | FK to players |
| `area_id` | TEXT | e.g. `"dungeon_frost"` |
| `unlocked_at` | DATETIME | |

### `discovered_secrets`
| Column | Type | Notes |
|---|---|---|
| `player_id` | INTEGER | FK to players |
| `secret_id` | TEXT | e.g. `"wall_jump_crack"` |
| `discovered_at` | DATETIME | |

### `items` (catalog)
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | |
| `name` | TEXT | e.g. `"Feather"`, `"Spring"`, `"Lantern"` |
| `passive_effect` | TEXT | key identifying the ability modifier |
| `world_trigger` | TEXT NULLABLE | what environment interaction this item enables |

### `cosmetics` (catalog)
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | |
| `name` | TEXT | |
| `unlock_condition` | TEXT | secret_id or area_id that grants this cosmetic |

`skill_level` is recomputed as `COUNT(discovered_secrets) + COUNT(unlocked_areas)` and cached on the players row. It gates area access checks but is not shown directly to the player.

---

## World Structure

The world is divided into three room types, each mapped to a Socket.io room:

### Overworld
- One global room: all connected players are here by default.
- Large isometric map, the hub for everything.
- No player cap.
- Server broadcasts position updates at ~20 ticks/sec.

### Dungeons
- Named rooms (e.g. `"dungeon_frost"`, `"dungeon_deep"`).
- Entered via portal objects in the overworld.
- Many players, no hard cap (or a soft cap of ~50).
- Some dungeons require a minimum `skill_level` to enter.

### Small Rooms
- Hard cap of ~4–8 players.
- Intimate spaces — puzzle rooms, secret chambers, collaborative challenges.
- Accessible via hidden entrances in the overworld or dungeons.

---

## Core Mechanics

### Movement

All players start with one ability: **Jump**. Additional techniques are hidden and must be discovered through play. The server validates each discovery trigger.

| Technique | How discovered | Notes |
|---|---|---|
| Jump | Default — everyone has it | Base verb |
| Wall jump | Jumping while pressed against a wall | Server checks position + wall contact |
| Dive / fast fall | Pressing down while airborne | |
| Bounce off others | Landing on another player's head | Requires two players to coordinate |

Undiscovered techniques are invisible to the player — no hint system. Finding them is the game.

### Items

One item per player at all times, enforced server-side. Items have three simultaneous behaviors:

1. **Passive** — modifies the holder's movement or abilities while held (e.g. Feather: floaty jump, Spring: extra jump height, Lantern: reveals hidden platforms).
2. **Droppable** — player can drop the item into the world at their current position. Another player can walk over it to pick it up (if their hands are empty).
3. **World-interactive** — items can be used against specific triggers in the environment (pressure plates, switches, doors). The item may be consumed or remain.

Item state (who holds what, where dropped items are) is authoritative on the server. The client renders item positions based on server state.

### Discovery & Secrets

Secrets are server-side trigger definitions: a combination of `(area, position_zone, action, optional_item)`. When the server detects a match, it records the secret to the player's profile and increments `skill_level`.

Discovery flow:
1. Player performs an unexpected action in a specific location.
2. Server matches against secret trigger table.
3. If matched: `discovered_secrets` row inserted, `skill_level` incremented.
4. Effect fires: area unlock, cosmetic unlock, world state change, or nothing (some secrets are just secrets).

The trigger table is server-only — never sent to the client.

### Cosmetics

Cosmetics are unlocked through discovery (finding secrets, reaching areas). They are never purchasable or chosen freely. Your appearance reflects what you've done. The cosmetic system covers: body color palette, shape variant, and one accessory slot.

---

## Multiplayer Sync

- Player positions are sent from client to server on every input frame.
- Server broadcasts all player positions in the same room to all room members at ~20 ticks/sec.
- Client interpolates between received positions for smooth rendering.
- Item world-state (dropped positions, held-by) is broadcast on change events, not every tick.
- Discovery events are private — only the discovering player receives the confirmation.

---

## Isometric Rendering

Phaser.js does not have built-in isometric support. Implementation approach:

- Use tile-based world coordinates `(tileX, tileY, tileZ)` internally.
- Convert to screen coordinates for rendering: `screenX = (tileX - tileY) * tileWidth / 2`, `screenY = (tileX + tileY) * tileHeight / 2 - tileZ * tileHeight`.
- Tiles rendered in painter's order (back-to-front) to handle depth correctly.
- Height (`tileZ`) is what "jumping" modifies — visually shows as the character rising above the ground plane.

---

## Out of Scope (v1)

- Chat or any text communication between players.
- Player-vs-player combat.
- Crafting or item combination.
- Account recovery.
- Mobile / touch input.
- Map editor or user-generated content.
