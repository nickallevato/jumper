# Jumper — Backlog (prioritized)

> The loop reads this top-down each iteration, picks the top unblocked item, builds a vertical
> slice, runs the [quality bar](./PILLARS.md#quality-bar-definition-of-done-for-an-iteration),
> feel-checks with the human, then updates [GDD.md](./GDD.md) and this file.

**Scoring:** each item tagged with **Pillar(s)** it serves, **Size** (S/M/L), and **Gap?**
(does it close a "looks-done-but-isn't" gap from the GDD). Gap-closers and feel-first items rank highest.

---

## Idea Sketches

### Tandem Lift — co-op super-jump (#42)
Two players stand on adjacent tiles and both hold jump. Instead of two small hops, a shared
"charge" builds (a faint glow growing between them); when it peaks, one player is flung far
higher than any solo move can reach — high enough to clear a ledge that's deliberately just out
of solo range. It's discoverable with no hint: a curious pair experimenting with simultaneous
jumps near each other will feel the charge catch and see the glow, and the world is seeded with
"impossible" ledges that quietly teach players to seek a partner. It deepens the existing
head-bounce into an intentional two-player verb (Pillar 4) built only from the jump button
(Pillar 2), and the launch must be server-validated like head-bounce (Pillar 6). The reward for
the launched player is a discovery + cosmetic, so cooperation literally becomes part of "what
you've done" (Pillar 3) — and the lifter is incentivized to find someone to lift back.

---

## World Growth (PAUSED — loop is now brainstorming-only)

The overworld is at 48x64; growth is paused while the loop focuses on idea generation.
When resumed: the loop grows the overworld one band per iteration, alternating append directions.
To grow: append the next direction to `OVERWORLD_GROWTH` in `client/src/maps.js`.
- Applied so far: **east, south, east, south, east**
- **Next direction: south** (note: cols now at 64 cap — next east will be a no-op)
- Rotation: east → south → east → south … (append-only; W/N deferred — would need a
  coordinate-offset refactor since secret zones/puzzle coords are absolute). Cap 64/dim.

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

### 20. Fall-out recovery — *Pillars 6 · Size S*
If a player drops below the floor (off a tall ledge in a follow-room), respawn at room spawn
instead of falling forever. Safety net for vertical levels.

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

### 31. Discovery ripple ring — *Pillars 5 · Size S*
An expanding ring effect at the player's position when a secret fires; reinforces the moment.

### 32. Parallax background layer — *Pillars 5 · Size M*
A faint parallax starfield/pattern behind the world for depth; scrolls slower than the camera.

### 33. Camera deadzone for follow — *Pillars 5 · Size S*
A small deadzone on the follow camera so tiny movements don't jitter the view.

### 34. Remote player idle bob — *Pillars 5 · Size S*
Extend idle breathing/bob to remote players (detect a stationary interpolation target).

### 36. Landmark beacons in grown areas — *Pillars 1,5 · Size M*
Occasional tall markers/structures seeded into the expanding bands so the open world has
something to navigate toward (grown areas are currently featureless).

### 40. Biome tinting per region — *Pillars 5 · Size M*
Shift the ground palette gradually by distance from origin so parts of the growing world feel
like distinct regions.

### 41. Whisper stones (async no-chat marks) — *Pillars 1,4 · Size M*
A player can leave a small mark from a fixed glyph set (no free text → respects no-chat) at a
spot; later players find it. Async social presence + a way to point each other at secrets without
words.

### 42. Tandem lift (co-op super-jump) — *Pillars 2,4 · Size M*
Two players on adjacent tiles both hold jump to "charge", then one launches far higher than any
solo move. Extends head-bounce into a deliberate two-player verb; unlocks routes neither can reach alone.

### 43. Echo of the bell (world reveal pulse) — *Pillars 1,4 · Size S*
Ringing the Belltower bell briefly reveals hidden (Lantern) tiles for everyone, everywhere, for a
few seconds — turning one player's climb into a fleeting world-wide opportunity window.

### 44. Footprint glyphs (movement-as-input) — *Pillars 1,2 · Size M*
Walking a specific shape/path over certain ground (no marked hint) triggers a secret. Movement
itself becomes a hidden input language — pure discovery.

### 45. Low-gravity zones — *Pillars 1,2 · Size M*
Tiles/regions where jump gravity is reduced (discoverable by feel); stack with the Feather for
huge floaty arcs. Enables otherwise-impossible routes; a world element that reshapes the core verb.

### 46. Ice / slide tiles — *Pillars 1,2 · Size M*
Tiles where the player keeps sliding (momentum carries past input release). Discoverable by feel;
combine with a running jump for long glides, or chain across to reach otherwise-blocked spots. A
world element that bends the core movement verb without a new button.

### 47. Pressure-choir (N-player simultaneous plates) — *Pillars 1,4 · Size M*
Several plates that must all be weighted at the SAME time to open something — needs a group, not
a clever solo. Extends the Counterweight to true multi-player coordination; distinct from the
single-player floor-sequence puzzle. No UI hint — players see plates reset when one steps off.

### 48. Drifting fog (atmospheric concealment) — *Pillars 1,5 · Size M*
Slow-drifting fog hides distant tiles, thinning near the player. Rewards exploration (you must go
look), adds mood, and can conceal secrets/landmarks until approached — pairs with the large world.

### 49. The Undercroft — descend-by-diving dungeon — *Pillars 1,2 · Size M*
A vertical dungeon you go DOWN instead of up: dive (down-while-airborne) through gaps to drop to
lower ledges; camera follows downward. Mirror of the Belltower, built on the dive verb; reaching
the bottom records a secret.

### 50. Resonance tiles (audio-sequence puzzle) — *Pillars 1 · Size M*
Tiles each emit a distinct tone when stepped on; a nearby fixture plays a short sequence, and
stepping the matching tiles in order opens a passage. Uses the new SFX system; pure listen-and-
repeat discovery, no on-screen hint.

### 37. Minimap for the growing world — *Pillars 6 · Size M*
A small camera-fixed overview of the overworld bounds + your position + portal locations.
Navigation aid for the now-large map (layout isn't a discovery secret, so this is fair).


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
- ✓ Camera punch on discovery — brief shake + soft green flash when a secret fires (pairs with
  the discovery sound).
- ✓ Platform pillar rendering (player-reported) — raised tiles now draw full-height pillars to
  the ground (depth = tz*TILE_H), so a player's elevation on a platform is legible.
- ✓ Growing overworld — append-only growth system (`OVERWORLD_GROWTH`); first band east (16x32),
  camera-follow enabled; loop grows one band/iteration alternating direction.
- ✓ Wall clipping fix (player-reported) — wall collision used `floor`, letting players walk a
  half-tile into the visible wall; switched to `round` so walls block at their drawn edge.
- ✓ Raised walls (player-reported) — walls drew at tz=0 with depth extending downward (sunken),
  so a player next to a wall looked ~half a tile too high; walls now render as raised blocks
  (top one tile up, body to the ground), consistent with platform pillars.
- ✓ Idle bob — local player gently breathes (subtle vertical bob) when standing still on ground.
- ✓ World growth: south band → overworld now 32x32.
- ✓ Ground texture variation — deterministic per-tile top-color jitter on ground/water so the
  growing grassland reads as textured, not a flat uniform plane.
- ✓ World growth: east band → overworld now 32x48.
- ✓ Portal color tiering — distinct color per portal destination (grove green, belltower gold,
  library violet, return sky) for at-a-glance wayfinding.
- ✓ World growth: south band → overworld now 48x48.
- ✓ Spawn-relative compass — edge arrow points home when spawn is off-screen (large-world nav).
- ✓ World growth: east band → overworld now 48x64 (cols at 64 cap).

---

## Parking lot (ideas, unscored)

World events visible to all · trading/gifting items · ambient world life · sound/music ·
day-night cycle · seasonal cosmetics.
