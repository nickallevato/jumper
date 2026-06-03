# SMA-286 Colyseus Loop Baseline

Captured on 2026-06-03 against the actual `JumperRoom` Colyseus loop.

## Method

Server:

```bash
JUMPER_PROFILE=1 JUMPER_PROFILE_LOG_INTERVAL_MS=2000 JUMPER_MAX_CLIENTS=50 PORT=2567 pnpm --filter @jumper/server dev
```

Load:

```bash
pnpm --filter @jumper/server loadtest -- --clients=5 --duration-sec=20
pnpm --filter @jumper/server loadtest -- --clients=25 --duration-sec=20
pnpm --filter @jumper/server loadtest -- --clients=50 --duration-sec=20
```

`JUMPER_MAX_CLIENTS=50` keeps the 50-client run in one room. Profiling is opt-in via
`JUMPER_PROFILE=1` and wraps the real `setSimulationInterval()` callback plus the
Colyseus schema patch path (`encoder.encode()` and `client.raw()` fan-out).

## Baseline

| Clients | Sim p50 / p95 ms | Patch wall p50 / p95 ms | Patch encode p50 / p95 ms | Bytes / patch / client p50 / p95 | Fan-out p50 / p95 | Heap MB | Harness verdict |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 5 | 0.054 / 0.092 | 0.267 / 0.360 | 0.034 / 0.058 | 57 / 82 | 5 / 5 | 16.8 | PASS: 5/5 connected, 0 disconnects, 0 errors, no stale state |
| 25 | 0.089 / 0.130 | 0.349 / 0.472 | 0.032 / 0.053 | 268 / 360 | 25 / 25 | 19.6 | PASS: 25/25 connected, 0 disconnects, 0 errors, no stale state |
| 50 | 0.102 / 0.192 | 0.426 / 0.664 | 0.038 / 0.061 | 494 / 668 | 44 / 50 | 17.9 | PASS: 50/50 connected, 0 disconnects, 0 errors, no stale state |

## Dominant Cost

Simulation is not the bottleneck. At 50 clients, simulation p95 was about 0.19 ms,
raw schema encode p95 was about 0.06 ms, and full patch wall-clock p95 was about
0.66 ms. The largest measured cost is per-client patch fan-out/socket writes
multiplied by patch size; patch bytes per client also scale with player count.

This supports prioritizing sync payload trimming and fan-out observability before
deeper simulation optimization.
