# SMA-275 Warp + Collision Regression Test Strategy

Issue: SMA-275  
Parent exit gate: SMA-246 Engine Hardening  
Owner: QA Lead  
Implementation owner: QA Engineer

## Scope

This plan defines the exit-gate coverage required before SMA-246 can ship. It covers warp determinism, multiplayer observer consistency, remote desync checks for warps and moving collision surfaces, and tick determinism under load.

Current room graph from `client/src/maps.js`:

| Source room | Portal tile | Destination room | Expected landing |
| --- | ---: | --- | ---: |
| `overworld` | `(13,13)` | `dungeon_grove` | `ROOM_SPAWNS.dungeon_grove = (8,8,0)` |
| `dungeon_grove` | `(2,2)` | `overworld` | `ROOM_SPAWNS.overworld = (8,8,0)` |
| `overworld` | `(13,2)` | `dungeon_belltower` | `ROOM_SPAWNS.dungeon_belltower = (2,4,0)` |
| `dungeon_belltower` | `(4,4)` | `overworld` | `ROOM_SPAWNS.overworld = (8,8,0)` |
| `overworld` | `(2,7)` | `dungeon_library` | `ROOM_SPAWNS.dungeon_library = (5,8,0)` |
| `dungeon_library` | `(1,1)` | `overworld` | `ROOM_SPAWNS.overworld = (8,8,0)` |
| `dungeon_deep` | `(4,1)` | `overworld` | `ROOM_SPAWNS.overworld = (8,8,0)` |

Coverage must also assert that every room with a declared portal is included. `dungeon_deep` currently has a return portal but no overworld entry portal; if that is intentional because of skill-gated entry, the automated test should treat it as a one-way return route and log it as intentional coverage.

## Automated Regression Coverage

### 1. Portal Registry Completeness

Add a Vitest suite, suggested path `tests/warps.test.js`, that imports `ROOMS` from `client/src/maps.js` and `ROOM_SPAWNS` from `shared/constants.js`.

Assertions:

- Enumerate every `room.portals` entry in every room; fail if any portal destination is missing from `ROOMS`.
- For each portal, assert the destination has a canonical spawn in `ROOM_SPAWNS`.
- Assert the route matrix above is current, including the `dungeon_deep` one-way return.
- Assert each portal tile is inside the source room content bounds and not blocked by `isRoomPositionPassable(sourceRoom, { x: tx, y: ty })`.

Exit criterion: adding, removing, or moving a portal fails this suite unless the expected route matrix is updated.

### 2. Every-Portal Round-Trip Determinism

Add a browser regression harness, suggested artifact path `qa-artifacts/SMA-275/warp-roundtrip-report.json`, that drives the live app through every route in the portal registry.

For each bidirectional route:

1. Start from source room and move to the portal tile.
2. Trigger the warp.
3. Record `scene.roomId`, local player `{ tx, ty, tz }`, latest authoritative socket position, and screenshot.
4. Return through the destination room's return portal when one exists.
5. Repeat the full outbound+return cycle at least 5 times.

Assertions:

- Destination room is identical on every repeat.
- Landing position equals that destination's `ROOM_SPAWNS` entry within `epsilon <= 0.01` for `x/y/z`.
- Return landing equals `ROOM_SPAWNS.overworld` for every dungeon return.
- No cumulative drift: repeat 5 lands at the same tile and z as repeat 1.
- Local predicted state and latest server tick state converge within 2 server ticks after each warp.

The `dungeon_deep -> overworld` route should run as a direct seeded-room return test unless the product adds an overworld entry portal.

Exit criterion: no route has drift, wrong-room landing, or post-warp correction beyond 2 server ticks.

### 3. Multi-Observer Warp Consistency

Add a two-client browser/socket regression, suggested artifact path `qa-artifacts/SMA-275/multiplayer-warp-report.json`.

Setup:

- Client A is the warping player.
- Client B is an observer in the same room before the warp.
- When testing destination observation, add Client C in the destination room where supported.

Assertions:

- Before warp, all observers agree on Client A's source `{ roomId, x, y, z }` within `epsilon <= 0.01`.
- After Client A warps, Client A's position in the destination room is identical in Client A's local scene and every observer snapshot that can see that room.
- Client B no longer receives Client A in the old room tick payload after the warp.
- Client C sees Client A at the exact canonical destination spawn on the first stable tick after join/warp.
- No duplicate Client A entity remains in either room.

Exit criterion: every observer-visible state converges to the same room and coordinates within 2 server ticks, with no old-room ghost entity.

### 4. Remote Desync After Platforms and Counterweight Rides

Add automated multiplayer coverage for the collision surfaces most likely to desync:

- `overworld` counterweight plate and riser from `shared/puzzles.js`.
- Static raised platforms in every room.
- Hidden platforms in `dungeon_grove` and `dungeon_library` when Lantern reveal is active.

Assertions:

- When the counterweight plate is weighted by a player or dropped item, all connected clients receive `puzzle.raised === true` or `PUZZLE_STATE { raised: true }` before validating riser collision.
- A rider standing on or traversing the raised platform reports the same `{ x, y, z }` locally and remotely after 10, 20, and 40 ticks.
- Removing the weight lowers the riser consistently for all observers, and no client keeps a stale solid platform.
- Repeating the same traversal after a warp into and out of the room does not change the authoritative landing or rider z.
- Static platform landings in every room converge locally/remotely within `epsilon <= 0.05` after 2 server ticks.

Exit criterion: no stale collision state, no observer z mismatch above `0.05`, and no remote entity snapping to a different tile after platform/riser traversal.

### 5. Tick Determinism Under Load

Add a deterministic simulation suite for shared/server authority functions and a load-flavored browser/socket run.

Vitest deterministic checks:

- Feed identical movement input sequences into `clampAllowedRoomPosition` for each room and assert identical final state every run.
- Cover wall-adjacent moves, door-open vs door-closed passability, bounds clamps, fallout recovery, and z clamps.
- Drive counterweight state transitions using fixed player/item positions and assert identical raised/not-raised outputs across repeated runs.

Browser/socket load checks:

- Run at least 6 concurrent clients in `overworld`, including one warper, one counterweight rider, one plate/item weight, and observers.
- Replay the same timestamped input script 3 times.
- Capture final player positions, puzzle state, open-door state, and latest tick sequence metadata.

Assertions:

- Same input script produces the same final puzzle state and player tile/z outcome across all 3 runs.
- Tick cadence remains close to `TICK_MS = 50`; report median and p95 tick interval.
- No client receives non-finite, out-of-bounds, or impossible z values.

Exit criterion: all repeated runs produce identical state snapshots, with p95 tick interval documented. Any nondeterministic divergence must be filed as an SMA-246 blocker.

## Manual Feel Checks

These must be playtested because state equality alone cannot prove movement quality.

Required browser/playtest checks:

- Warp entry smoothness: approach every portal at walking speed and while jumping/falling; confirm the transition is readable and not abrupt.
- Warp exit smoothness: destination spawn should not visibly rubber-band, snap twice, or briefly show the old room.
- Multiplayer perception: observer should see the warping player leave/arrive cleanly, with no lingering sprite in the old room.
- Platform/counterweight rides: rider motion should look stable on the local and remote clients, with no visible foot sliding, vertical popping, or stale raised platform visuals.
- Under load: repeat one full route and one counterweight ride while 6 clients are active; confirm animation still feels playable.

Evidence:

- Save screenshots for representative key states.
- Save a short note per route in `qa-artifacts/SMA-275/feel-check-notes.md` with pass/fail and any visible artifacts.
- Any feel failure is release-blocking for SMA-246 even if automated coordinate assertions pass.

## Handoff Checklist for QA Engineer

- Create or update automated suites for registry completeness, round-trip determinism, observer consistency, platform/counterweight desync, and deterministic tick behavior.
- Store machine-readable reports under `qa-artifacts/SMA-275/`.
- Include the full room/portal matrix in the report so future route changes are visible.
- Run `npm test` for unit/Vitest coverage unless `ITERATION_MODE` exists; when it exists, run the smallest targeted test command and typecheck-equivalent available.
- Run browser/playtest verification for all manual feel checks.
- File child bug issues for any failure, linking them as blockers to SMA-246.

## SMA-246 Exit Gate

SMA-246 cannot be marked ready until:

- Every automated check above passes.
- Manual feel checks are recorded as pass.
- Any discovered warp, collision, observer, or determinism failures are fixed or linked as explicit blockers.
- Release validation includes the generated `qa-artifacts/SMA-275/*` reports and screenshots.
