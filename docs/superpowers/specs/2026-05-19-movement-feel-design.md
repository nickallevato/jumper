# Movement & Feel — Design Spec
*2026-05-19*

## Overview

Overhaul the jump physics and add discoverable movement mechanics. The goal is a jump that feels expressive and natural, with hidden techniques that reward experimentation.

---

## Stack

All changes are client-side (`client/src/Player.js`) except head-bounce detection, which requires a server-side position check in `server/rooms.js` and a new socket event. The secrets system already exists in `server/secrets.js` — new techniques are added as triggers there.

---

## Mechanic 1: Variable Jump Height

**Tap** space → short hop (~0.5 tiles). **Hold** space → full arc (~2 tiles).

Implementation: on first space press, apply minimum impulse `vz = MIN_JUMP_VEL = 0.14`. While space is held AND `vz > 0` (still rising), apply reduced gravity `GRAVITY * 0.35` instead of full gravity. Releasing space or starting to fall switches back to full gravity. This means the ascent hangs naturally when held; a tap decays immediately.

Constants:
- `JUMP_VELOCITY = 0.14` (minimum impulse — replaces current 0.30)
- `JUMP_HOLD_GRAV_FACTOR = 0.35` (gravity multiplier while holding on ascent)
- `GRAVITY = 0.022` (unchanged)

Max height when held: approximately `0.14² / (2 × 0.022 × 0.35) ≈ 1.27` tiles. Adjusted upward by applying full impulse: closer to ~2 tiles with the reduced gravity feel. Tunable.

---

## Mechanic 2: Squash & Stretch

Visual-only. Applies `gfx.setScale(sx, sy)` each frame, interpolated toward target.

| Event | Target scale | Duration |
|---|---|---|
| On jump | (0.85, 1.3) — tall stretch | 80ms |
| On land | (1.4, 0.65) — wide squash | 70ms then spring |
| Idle / air | (1.0, 1.0) | — |
| Wall kick | (1.3, 0.85) horizontal stretch | 100ms |

Spring-back: after squash/stretch peak, lerp back to (1.0, 1.0) over ~150ms.

State: `_scaleX`, `_scaleY`, `_targetScaleX`, `_targetScaleY`. Each frame lerp current → target at rate 0.25.

---

## Mechanic 3: Coyote Time

When the player walks off a ledge (loses ground contact without jumping), start `_coyoteTimer = 120` (ms). If space is pressed while `_coyoteTimer > 0` and `!onGround`, trigger a coyote jump.

Coyote jump: always `vz = COYOTE_VEL = 0.16`, **no hold bonus** — reduced gravity multiplier does not apply during coyote jump. Always the same fixed small arc regardless of how long space is held. Enough to grab back the tile you slipped from; not enough to cross a new gap.

To distinguish: set `_isCoyoteJump = true` on coyote jumps, skip the hold-reduction logic when true.

---

## Mechanic 4: Wall Slide + Double-Tap Kick (Discoverable)

**Wall slide:** when the player is airborne and pressing into a wall tile, gravity is reduced to `GRAVITY * 0.18` — very slow fall. Visual: player gfx x-offset toward the wall slightly (2px) to show contact.

Wall contact detection: check if the tile in the direction of horizontal input (`dx > 0` → check tile at `floor(tx+0.7)`, `dx < 0` → check tile at `floor(tx-0.1)`) or vertical input is type 2. Also check y-axis. Store `_wallDir = {x, y}` (unit vector away from wall) when sliding.

**Double-tap kick:** track `_lastJumpTap` timestamp. If space is pressed again within 280ms of a previous press while `_isWallSliding`, trigger a wall kick: apply velocity `vz = JUMP_VELOCITY * 1.1` + `tx += _wallDir.x * WALL_KICK_SPEED`, `ty += _wallDir.y * WALL_KICK_SPEED`. Apply wall-kick squash/stretch. Set `_wallKickCooldown = 400ms` — can't re-enter wall slide immediately.

`WALL_KICK_SPEED = 1.8` (tile units per kick — strong lateral push).

**Discovery:** wall-kicking in the trigger zone (server-side, any tile adjacent to a wall, action: `wall_kick`) records secret `secret_wall_kick`. Effect: unlocks cosmetic.

---

## Mechanic 5: Head Bounce (Discoverable)

When player A lands on player B's head (A is falling, A's `tz` passes through B's `tz + 0.5` range within 0.6 tile horizontal distance), A gets a bounce: `vz = JUMP_VELOCITY * 1.2` (slightly higher than normal jump).

Detection: server-side in the tick loop. On each tick, for every pair of players in the same room, check:
- Horizontal distance < 0.6 tiles
- Player A is falling (`vz < 0`, approximated as A's z is decreasing)
- A's z is within [B.z, B.z + 0.8]

On match: server emits `HEAD_BOUNCE` to player A → client sets `vz = BOUNCE_VEL`.

B is unaffected (no knockdown). This is cooperative — requires two players to set up.

**Discovery:** first time a player receives `HEAD_BOUNCE`, server records `secret_head_bounce`. Effect: unlocks cosmetic.

---

## Mechanic 6: Hidden Technique (Undocumented)

*(Omitted from spec intentionally — implemented but not described here.)*

---

## Socket Events (new)

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `bounce:head` (`BOUNCE_HEAD`) | server → client | `{ vel }` | Tell player A to bounce upward |

---

## Server Changes

### `server/rooms.js`
- In tick loop: head-bounce pair detection. Emit `bounce:head` to affected player. Record discovery via `checkDiscovery`.

### `server/secrets.js`
- Add trigger: `secret_wall_kick` — action `wall_kick`, any position adjacent to a type-2 tile.
- Add trigger: `secret_head_bounce` — fires on `bounce:head` receipt (server-side on emit).
- Add trigger for hidden mechanic.

### `shared/constants.js`
- Add `BOUNCE_HEAD: 'bounce:head'` to SOCKET_EVENTS.
- Add `MIN_JUMP_VEL`, `JUMP_HOLD_GRAV_FACTOR`, `COYOTE_VEL`, `WALL_KICK_SPEED`.

---

## Client Changes

### `client/src/Player.js`
All new state lives here. No new files needed.

New state fields:
- `_coyoteTimer`, `_isCoyoteJump`
- `_isWallSliding`, `_wallDir`, `_lastJumpTap`, `_wallKickCooldown`
- `_scaleX`, `_scaleY`, `_targetScaleX`, `_targetScaleY`

### `client/src/scenes/WorldScene.js`
- Wire `bounce:head` socket event → `this.player.applyBounce(vel)`
- Add `bounce:head` to `shutdown()` cleanup

---

## Out of Scope

- Wall jump as a distinct move (wall slide + kick covers this)
- Directional fast-fall (down key fast-fall removed from design — user declined)
- Any server-side physics validation (client is authoritative on position)
