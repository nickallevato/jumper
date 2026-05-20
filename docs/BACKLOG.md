# Jumper — Backlog (prioritized)

> The loop reads this top-down each iteration, picks the top unblocked item, builds a vertical
> slice, runs the [quality bar](./PILLARS.md#quality-bar-definition-of-done-for-an-iteration),
> feel-checks with the human, then updates [GDD.md](./GDD.md) and this file.

**Scoring:** each item tagged with **Pillar(s)** it serves, **Size** (S/M/L), and **Gap?**
(does it close a "looks-done-but-isn't" gap from the GDD). Gap-closers and feel-first items rank highest.

---

## Now (next iteration)

## Later

### 14. Landing dust puff — *Pillars 5 · Size S*
A small particle/graphic burst when the player lands, scaled by fall speed. Pure juice.

### 15. Wind updraft column — *Pillars 1,2 · Size M*
A vertical column that lifts airborne players upward (stronger while holding the Feather).
Discoverable world element with item synergy; enables reaching otherwise-impossible heights.

### 16. Moving patrol platform — *Pillars 2,5 · Size M*
A platform that oscillates between two points (server-authoritative position). Ride it or time
jumps onto it. Enriches dungeons and the future Belltower.

### 18. Idle bob animation — *Pillars 5 · Size S*
Players gently bob/breathe when standing still. Cheap liveliness; reads as "alive" not frozen.

### 20. Fall-out recovery — *Pillars 6 · Size S*
If a player drops below the floor (off a tall ledge in a follow-room), respawn at room spawn
instead of falling forever. Safety net for vertical levels.

### 21. Camera punch / shake on discovery — *Pillars 5 · Size S*
A brief zoom-punch + shake when a discovery fires; juice that makes finds feel momentous.

### 22. Belltower checkpoints — *Pillars 6 · Size S*
Respawn at the highest ledge reached so a missed jump doesn't drop you to the very bottom.
Reduces frustration on vertical climbs.

### 23. Ambient floating motes — *Pillars 5 · Size S*
Slow drifting particles in dungeon rooms for atmosphere; cheap mood without gameplay impact.

### 24. Distance-faded remote players — *Pillars 5 · Size S*
Remote players far from you render slightly transparent as a depth/focus cue.

### 25. Ambient room drone — *Pillars 5 · Size M*
A soft looping pad/drone per room for mood (distinct tone per area). WebAudio, no assets.

### 26. Controls help overlay — *Pillars 6 · Size S*
A toggleable panel showing basic movement controls only (WASD/jump/emote/use) — never discovery
hints, so it stays true to "discovery is the game".

### 27. Stereo panning by position — *Pillars 5 · Size S*
Pan sound effects left/right by the source's screen-x for spatial feel (builds on the SFX system).

### 28. Mute persistence + volume — *Pillars 6 · Size S*
Remember mute state (and later volume) in localStorage so the choice survives reloads.

### 29. Drifting library platforms — *Pillars 2,5 · Size M*
Gentle vertical oscillation of book-stack platforms (tailored moving-platform variant; the
"drifting book-stacks" from the original Sunken Library design).

### 30. Dungeon vignette — *Pillars 5 · Size S*
A dark edge gradient overlay in dungeon rooms for mood/atmosphere; camera-fixed.

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
- ✓ Screen-relative WASD — W = straight up on screen (was a 45° grid axis); `screenToTileDir`
  maps input intent to tile space (player-requested feel fix).
- ✓ Camera-follow (per-room opt-in, content-clamped) + The Belltower — tall spiral-ledge shaft
  reached via overworld portal (13,2); reach the bell at the top for `secret_bell`.
- ✓ World-event bell broadcast — ringing the bell `io.emit`s a world event; everyone in every
  room sees a "a bell tolls in the distance" banner.
- ✓ Iso alignment quality pass (player-reported) — feet/shadow/tile-platform tops were misaligned
  (`-TILE_H/2` float + shadow pinned to ground). Established one anchor convention; shadow now
  tracks the standing surface with a height fade. Player/Remote/items/bell all consistent.
- ✓ Synthesized sound effects — WebAudio blips for jump/land/kick/pogo/bounce/pickup/discover/
  bell; lazy AudioContext, M toggles mute (persisted in localStorage).
- ✓ Platform landing fix (player-reported) — landing footprint used `floor(tx)`, offset half a
  tile from the centered diamond; switched to `round` so the target sits where the platform looks.
- ✓ The Sunken Library — dark dungeon (overworld portal 2,7); visible book-stacks climb partway,
  Lantern reveals the final shelves to the archive ledge → `secret_archivist`.

---

## Parking lot (ideas, unscored)

World events visible to all · trading/gifting items · ambient world life · sound/music ·
day-night cycle · seasonal cosmetics.
