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

### 10. Dive-portals (cracked floor tiles) — *Pillars 1,2 · Size M*
Dive (down-while-airborne) onto a cracked floor tile to drop into a dungeon — canonical to the
original design ("unlocked by diving into a specific cracked floor tile"). Combines the dive verb
with room transitions; a discoverable, unhinted entrance distinct from walk-on portals.

### 5. Floor-sequence puzzle (small room) — *Pillars 1,2 · Size M*
Hidden-order pressure plates; wrong order resets, right order opens a door. No UI hint.

### 6. Mirror relay puzzle (small room) — *Pillars 1,4 · Size L*
Cooperative light-beam bounce between player-placed mirrors. Multiplayer-coordination puzzle.

### 7. The Sunken Library (dungeon) — *Pillars 1,2 · Size L · depends on #1, #4*
Dark dungeon, drifting book-stack platforms; Lantern reveals hidden shelves. Depends on dungeons
+ Lantern reveal.

### 8. Lantern reveal mechanic — *Pillars 1 · Size S · Gap ✓*
Hidden tiles that only render when a player holding the Lantern is nearby. Enables #7.

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

---

## Parking lot (ideas, unscored)

World events visible to all · trading/gifting items · ambient world life · sound/music ·
day-night cycle · seasonal cosmetics.
