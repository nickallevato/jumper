# Quality Bar

What "green" means for the Jumper project and how to enforce it.

## Gates

| Gate | Command | What it checks |
|------|---------|---------------|
| Typecheck | `pnpm run typecheck` | All packages compile with `--noEmit` (strict mode) |
| Server tests | `pnpm --filter @jumper/server test` | Colyseus room lifecycle, multiplayer state sync, movement, jump physics |
| Client build | `pnpm --filter @jumper/client build` | Vite production bundle succeeds (includes tsc --noEmit) |

All three gates must pass for a build to be considered green.

## Smoke Script

```bash
bash scripts/smoke.sh
```

Runs every gate in order and exits non-zero on the first failure. This is the single entry point for local validation and the contract the CI/deploy pipeline plugs into.

### Exit codes

- `0` — all gates passed
- non-zero — the failing gate is printed to stderr

## Adding Tests

Server tests live in `server/src/__tests__/` and use [vitest](https://vitest.dev). They spin up a real Colyseus server on a test port and connect with the `colyseus.js` client — no mocks.

To run tests in isolation:

```bash
pnpm --filter @jumper/server test
```

## CI Integration

The deploy pipeline should run `bash scripts/smoke.sh` as its quality gate. A non-zero exit blocks the deploy. See the deploy track for pipeline configuration.
