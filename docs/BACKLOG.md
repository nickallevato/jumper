# Jumper — Backlog (prioritized)

> The loop reads this top-down each iteration, picks the top unblocked item, builds a vertical
> slice, runs the [quality bar](./PILLARS.md#quality-bar-definition-of-done-for-an-iteration),
> feel-checks with the human, then updates [GDD.md](./GDD.md) and this file.

**Scoring:** each item tagged with **Pillar(s)** it serves, **Size** (S/M/L), and **Gap?**
(does it close a "looks-done-but-isn't" gap from the GDD). Gap-closers and feel-first items rank highest.

---

## Now (next iteration)

### 3. The Belltower (first designed dungeon) — *Pillars 1,2,5 · Size M · Gap ✗ (depends on #1)*
Tall vertical wall-kick shaft, ~4 tiles wide, spiraling ledges. Showcases the new wall-kick tech.
First to ring the bell triggers a world event in the overworld. Depends on #1.

## Later

### 12. Synthesized sound effects — *Pillars 5 · Size M*
WebAudio-generated blips for jump / land / discover / pickup — no asset files. Adds feel/juice.

### 14. Landing dust puff — *Pillars 5 · Size S*
A small particle/graphic burst when the player lands, scaled by fall speed. Pure juice.

### 15. Wind updraft column — *Pillars 1,2 · Size M*
A vertical column that lifts airborne players upward (stronger while holding the Feather).
Discoverable world element with item synergy; enables reaching otherwise-impossible heights.

### 16. Moving patrol platform — *Pillars 2,5 · Size M*
A platform that oscillates between two points (server-authoritative position). Ride it or time
jumps onto it. Enriches dungeons and the future Belltower.

### 17. Camera-follow + vertical levels — *Pillars 6 · Size M · Gap ✓ (blocks #3, #7)*
Smooth camera follow with world bounds, per-room opt-in (default off so existing small rooms are
unchanged). The recurring blocker for tall/large rooms — needed before the Belltower or Sunken
Library can render properly.

### 18. Idle bob animation — *Pillars 5 · Size S*
Players gently bob/breathe when standing still. Cheap liveliness; reads as "alive" not frozen.

### 10. Dive-portals (cracked floor tiles) — *Pillars 1,2 · Size M*
Dive (down-while-airborne) onto a cracked floor tile to drop into a dungeon — canonical to the
original design ("unlocked by diving into a specific cracked floor tile"). Combines the dive verb
with room transitions; a discoverable, unhinted entrance distinct from walk-on portals.

### 5. Floor-sequence puzzle (small room) — *Pillars 1,2 · Size M*
Hidden-order pressure plates; wrong order resets, right order opens a door. No UI hint.

### 6. Mirror relay puzzle (small room) — *Pillars 1,4 · Size L*
Cooperative light-beam bounce between player-placed mirrors. Multiplayer-coordination puzzle.

### 7. The Sunken Library (dungeon) — *Pillars 1,2 · Size L*
Dark dungeon, drifting book-stack platforms; Lantern reveals hidden shelves. Dungeons + Lantern
reveal now exist — this is unblocked.


---

## Done

- ✓ Core game loop (iso world, movement, multiplayer sync, items, discovery) — Tasks 1–15
- ✓ Visual overhaul (3D tiles, blob characters, elevated platforms, shadows)
- ✓ Bobbing world items · held-item indicator dot
- ✓ Movement & feel: variable jump, squash/stretch, coyote, wall slide+kick, head bounce, pogo
- ✓ The Counterweight puzzle — drop-item-as-weight (or coop player-weight) raises a platform
  to reach a high goal ledge; new use of the drop verb. (`secret_counterweight`)
- ✓ Real dungeon rooms — room registry (`maps.js`), portal tiles, scene fade transitions,
  `dungeon_grove` starter dungeon; puzzle scoped to overworld.
- ✓ Cosmetic rendering — shared cosmetics catalog (DB seed + render source of truth); secrets
  equip `cosmetic_id`; local + remote players render palette + accent; live recolor on discovery.
- ✓ Items become meaningful — seeded starter world items; Key + locked door (Grove vault), E to
  use, server-authoritative door state, `secret_locksmith` cosmetic, Lantern reward inside.
- ✓ Discovery counter HUD — camera-fixed `✦ N` of secrets found (unhinted: no totals/names),
  pops on each new discovery, persists across rooms via the profile.
- ✓ Emote / wave — press F to wave, relayed to others in the room as a bubble above the head;
  strangers communicate without chat (cooperative pillar).
- ✓ Held-item state sync — server privately emits `item:held` (join/pickup/drop/key-use); fixes
  stale held indicator after pickup/drop, fixes door-open wrongly clearing others' items;
  foundational for the Lantern reveal mechanic.
- ✓ Lantern reveal mechanic — hidden platforms (Grove) appear + become solid only while holding
  the Lantern; stepping-stone path across the pool to `secret_illuminated`.
- ✓ Room player-count HUD — camera-fixed "N here" / "here alone", updated off the tick list.

---

## Parking lot (ideas, unscored)

World events visible to all · trading/gifting items · ambient world life · sound/music ·
day-night cycle · seasonal cosmetics.
