# Jumper — Game Design Document (living)

> Living north star. Updated every iteration to describe **what exists now**, not what's planned.
> Planned work lives in [BACKLOG.md](./BACKLOG.md); principles live in [PILLARS.md](./PILLARS.md).
> Original specs preserved under `docs/superpowers/specs/` for history.

*Last synced: 2026-05-20*

---

## 1. Overview

Jumper is a browser-based isometric MMO where anonymous players jump around a shared world,
discover hidden movement techniques and secrets, collect and trade items, and unlock new areas
through exploration. Simple mechanics combine in emergent ways.

## 2. Stack

| Layer | Technology |
|---|---|
| Client | Phaser 3 (manual isometric coordinate transform) |
| Real-time sync | Socket.io |
| Server | Node.js + Express (ESM) |
| Persistence | SQLite (`better-sqlite3`) |
| Bundler | Vite 5 |
| Tests | Vitest |

Dev: backend on `:3002` (`npm run dev:server`), Vite on `:5173` (`npm run dev:client`).
Vite proxies `/api` and `/socket.io` to `:3002`.

## 3. Identity & Auth

UUID token issued on first visit, stored in `localStorage`; no usernames/passwords/email.
Players are identified purely by cosmetic appearance. Clearing localStorage = fresh profile
(intentional).

## 4. Data Schema (implemented)

`players` (token, cosmetic_id, held_item_id, skill_level, last_seen, created_at) ·
`unlocked_areas` (player_id, area_id) · `discovered_secrets` (player_id, secret_id) ·
`items` catalog · `cosmetics` catalog · `world_items` (dropped items in world).

`skill_level = COUNT(discovered_secrets) + COUNT(unlocked_areas)`, cached on the players row,
recomputed on discovery. Gates area access; not shown to the player.

## 5. World Structure

- **Overworld** — single global room, 16×16 grid, no cap, all players by default. **(implemented)**
- **Dungeons** — named rooms with their own grids/platforms/spawn/bg, entered via **portal
  tiles**. `dungeon_grove` (ungated starter: a sunken pool with stepping stones) is reachable
  from the overworld portal at (13,13); return portal at grove (2,2). Skill-gated rooms
  (`dungeon_sky` ≥1, `dungeon_deep` ≥2) still enforced server-side on join. Rooms defined in
  `client/src/maps.js`; WorldScene renders whichever room it's started with and fades between them.
- **Small rooms** — soft cap (`ROOM_CAP_SMALL=6`) enforced for `small_*` rooms. *No content yet.*

The overworld has elevated platforms players can jump onto, and three secret trigger zones.

## 6. Movement (implemented — see `client/src/Player.js`)

Base verb is **Jump**. Techniques are hidden and discovered by play:

| Technique | Trigger | Feel |
|---|---|---|
| Variable jump height | Tap = short hop; hold Space = reduced gravity on ascent → full arc | core |
| Squash & stretch | Visual on jump/land/kick/bounce, springs back to neutral | juice |
| Coyote time | Space within 120ms of leaving a ledge → fixed small-arc jump | forgiveness |
| Wall slide + kick | Press into wall airborne (slow fall); double-tap Space → kick off | discoverable |
| Head bounce | Land on another player's head → upward bounce (server-detected) | cooperative |
| Pogo (hidden) | Tap Space within 120ms of landing → boosted jump; chains higher | mastery |

Tunables in `shared/constants.js`. Dive/fast-fall exists as a discovery action only.

## 7. Items (implemented)

One item per player, enforced server-side. Three behaviors: **passive** (movement modifier
while held — Feather/floaty, Spring/high-jump, Lantern/reveal), **droppable** (drop into world,
others pick up if empty-handed; auto-pickup within 0.8 tiles), **world-interactive** (use against
a trigger — Key/unlock_door; effect logic stubbed). Held-item indicator dot shown above the head.
World items bob.

## 8. Discovery & Secrets (implemented — `server/secrets.js`)

Server-side trigger = `(roomId, optional zone, action, optional item)`. On match: record secret,
unlock area/cosmetic, recompute skill_level, emit private `discover:ok`. Trigger table is
server-only. Current secrets: wall_crack (jump@zone), feather_wind (move+Feather@zone),
deep_dive (dive@zone), wall_kick / head_bounce / pogo (technique, position-independent),
counterweight (reach the puzzle goal ledge).

### The Counterweight puzzle (implemented — `shared/puzzles.js`, server tick loop)

A pressure **plate** at (11,12) linked to a **riser** platform at (8,12). Weighting the plate —
by a player standing on it OR a dropped world item resting on it — raises the riser from z0→1.0
(server-authoritative, broadcast via `puzzle:state`; client tweens it). The riser is the only way
up to a **goal ledge** at (8,11, z2.0): unreachable from the ground (max jump ≈1.27) but reachable
ground→riser→goal. Reaching it records `secret_counterweight`. Solo solution sacrifices your item
on the plate; cooperative solution has one player weight the plate while another climbs.

## 9. Multiplayer Sync (implemented)

Client sends position on change; server broadcasts per-room player lists at 20 ticks/sec
(`TICK_MS=50`). Client interpolates remote players. Item world-state broadcast on change.
Discoveries are private. Head-bounce pair detection runs in the server tick loop.

## 10. Cosmetics

Unlocked through discovery/areas, never bought or freely chosen. Catalog seeded; **visual
rendering of cosmetic variants on the player sprite is NOT yet implemented** (everyone renders
the default blob).

## 11. Isometric Rendering (implemented)

World coords `(tx, ty, tz)` → screen via `iso.js`. `tz` is height (jump). Painter's order
back-to-front. 3D-look tiles, elevated platforms, drop shadows.

---

## Known gaps (the "looks done but isn't" list)

- Dungeon **scenes** — gating works, but joining a dungeon doesn't load a distinct map; no portals.
- Cosmetic **rendering** — unlocks are recorded but never shown on the sprite.
- Item **world-interaction** effects — `useItem` validates but fires no world change.
- Lantern **reveal** — passive effect flag exists; no hidden tiles to reveal yet.

## Out of scope (v1)

Chat · PvP · crafting · account recovery · mobile/touch · map editor/UGC.
