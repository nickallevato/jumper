# Jumper — Backlog (prioritized)

> The loop reads this top-down each iteration, picks the top unblocked item, builds a vertical
> slice, runs the [quality bar](./PILLARS.md#quality-bar-definition-of-done-for-an-iteration),
> feel-checks with the human, then updates [GDD.md](./GDD.md) and this file.

**Scoring:** each item tagged with **Pillar(s)** it serves, **Size** (S/M/L), and **Gap?**
(does it close a "looks-done-but-isn't" gap from the GDD). Gap-closers and feel-first items rank highest.

---

## Now (next iteration)

### 1. Real dungeon rooms — *Pillars 1,6 · Size L · Gap ✓✓✓*
Make the existing skill-gating actually load a distinct dungeon scene with its own grid, plus
a portal in the overworld to enter and a way back out. Closes the single biggest gap and unblocks
every dungeon idea below. Vertical slice: one stub dungeon grid, portal tile → `join:room`, scene
swap, return portal.

## Next

### 2. Cosmetic rendering — *Pillars 3 · Size M · Gap ✓✓*
Render `cosmetic_id` as real palette/shape/accessory variants on the player + remote players.
Makes "you are what you've done" actually visible. Currently unlocks are invisible.

### 3. The Belltower (first designed dungeon) — *Pillars 1,2,5 · Size M · Gap ✗ (depends on #1)*
Tall vertical wall-kick shaft, ~4 tiles wide, spiraling ledges. Showcases the new wall-kick tech.
First to ring the bell triggers a world event in the overworld. Depends on #1.

### 4. Item world-interaction effects — *Pillars 1 · Size M · Gap ✓*
Make `useItem` fire a real world change (Key opens a door object → reveals passage). Currently
validated server-side but inert.

## Later

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

---

## Parking lot (ideas, unscored)

World events visible to all · trading/gifting items · ambient world life · sound/music ·
day-night cycle · seasonal cosmetics.
