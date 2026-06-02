# Engine Runtime Notes

## Server Tick

The server advances authoritative room simulation with a fixed timestep:

- `SERVER_SIMULATION_STEP_MS = 50` in `shared/constants.js` (20 simulation ticks/sec).
- The loop uses an accumulator. If the Node event loop is delayed, it runs as many 50 ms simulation steps as elapsed time requires before emitting a snapshot.
- Puzzle and physics authority, including counterweight checks and head-bounce detection, must run only from the fixed simulation step.
- Cooldowns used by simulation must be based on accumulated simulation time, not `Date.now()`, so the same input sequence produces the same simulation sequence under different wall-clock frame timings.
- Broadcast cadence is configured separately with `SERVER_BROADCAST_MS`. Snapshot emission can change independently from simulation tick rate.

Client rendering and interpolation should treat `tick` snapshots as presentation data. They must not change the authoritative simulation cadence.

## Collision Footprints

Tile collision uses a centered diamond footprint. Any world position `(x, y)` maps to its collision tile with `Math.round(x), Math.round(y)`, matching how walls, platforms, and risers are drawn around tile centers.

- `clampAllowedRoomPosition` clamps room bounds first, then tries X and Y independently against `isRoomPositionPassable`. A wall tile blocks as soon as the player's rounded footprint enters that tile.
- Platform standing height uses the same rounded footprint through `groundHeightAt`. This is the rule for landing, walking off ledges, and grounded step gating.
- Grounded movement may step onto equal or lower surfaces. Walking up to a higher surface is blocked by `canStepTo`; the player must jump and land on it instead.
- The counterweight riser is a mutable platform, not a separate collision system. Its current `tz` is the standing height at the riser tile for rendering, landing, and grounded step gating.
- Content bounds are numeric room limits and are intentionally clamped before tile passability. They keep centered player footprints inside authored playable space.

Use `Math.floor` only for discrete action/discovery payloads that intentionally record the lower integer cell. It must not be used for movement collision, wall passability, platform landing, or riser standing height.
