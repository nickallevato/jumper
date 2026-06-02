# Engine Runtime Notes

## Server Tick

The server advances authoritative room simulation with a fixed timestep:

- `SERVER_SIMULATION_STEP_MS = 50` in `shared/constants.js` (20 simulation ticks/sec).
- The loop uses an accumulator. If the Node event loop is delayed, it runs as many 50 ms simulation steps as elapsed time requires before emitting a snapshot.
- Puzzle and physics authority, including counterweight checks and head-bounce detection, must run only from the fixed simulation step.
- Cooldowns used by simulation must be based on accumulated simulation time, not `Date.now()`, so the same input sequence produces the same simulation sequence under different wall-clock frame timings.
- Broadcast cadence is configured separately with `SERVER_BROADCAST_MS`. Snapshot emission can change independently from simulation tick rate.

Client rendering and interpolation should treat `tick` snapshots as presentation data. They must not change the authoritative simulation cadence.
