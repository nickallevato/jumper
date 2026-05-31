# Netcode Test Recipe — Reconnect + Dropout

How to manually verify Jumper's reconnect and dropout handling against a local server.

## What the server does

- **Reconnect window:** 30 seconds. On an unconsented disconnect, the room calls `allowReconnection(client, 30)` and keeps the player's `PlayerState` in `JumperRoomState.players`. Inputs are zeroed so the avatar freezes in place until the player rejoins or the window expires.
- **Consented leave:** `client.leave()` removes the player immediately — no reconnect window.
- **Dropout cleanup:** if the 30s window expires, the player is removed from state and inputs/pending-jump maps. Other clients see the avatar disappear via the normal Colyseus state-sync.
- **Empty room:** `autoDispose = true`, so once the last client leaves (consented or dropped) the room disposes gracefully.

Tunable: set `JUMPER_RECONNECT_WINDOW_SEC` on the server process to override 30s (the test suite uses 2s).

## Prereqs

- Run `pnpm install` once at the monorepo root.
- Two browser windows or tabs (Chromium is fine).

## Boot

```bash
# Terminal 1 — Colyseus server
pnpm --filter @jumper/server dev

# Terminal 2 — Vite client
pnpm --filter @jumper/client dev
```

Open `http://localhost:5173` in **two** windows (call them A and B).

## Scenario 1 — Reconnect within window

1. Confirm both A and B see two avatars on the isometric grid.
2. In window A, move the avatar with WASD until it's clearly away from spawn.
3. Disable A's network without closing the tab:
   - Chromium DevTools → Network tab → throttling dropdown → **Offline**.
4. In window B, watch A's avatar. It should freeze (no movement) but stay rendered.
5. Within 30 seconds, set A's throttling back to **No throttling**.
6. The Colyseus client auto-reconnects (Jumper uses `client.reconnect(reconnectionToken)` on socket-drop). A's avatar resumes moving in both windows from the position it was frozen at.

**Pass criteria**

- A's avatar position is preserved across the disconnect (no respawn at random coords).
- B sees no flicker, ghost, or duplicate avatar for A.
- No errors in either browser console; no exceptions in the server log other than the expected `[JumperRoom] player disconnected, awaiting reconnect: <sessionId>` followed by `[JumperRoom] player reconnected: <sessionId>`.

## Scenario 2 — Dropout past window

1. Same starting state: A and B both connected, two avatars visible.
2. Force-kill A's tab (close the window — not a clean leave; the WebSocket drops without a `leave()` message).
3. Watch the server log: `[JumperRoom] player disconnected, awaiting reconnect: <sessionId>`.
4. Wait at least 35 seconds (longer than the 30s reconnect window).
5. Server log shows `[JumperRoom] reconnect window expired, dropping: <sessionId>`.
6. In window B, A's avatar disappears.

**Pass criteria**

- B's game keeps running smoothly through the drop and the eventual removal — no console errors, no crash.
- `JumperRoomState.players` no longer contains A's sessionId (visible via Colyseus monitor at `http://localhost:2567/colyseus` if enabled, or inferred from B's view).
- If B then closes too, server logs `[JumperRoom] disposed (<roomId>)` confirming the empty room is reaped.

## Scenario 3 — Empty room reaped

1. Single client connects.
2. Force-close the tab (unconsented drop).
3. After the 30s window, server logs both `reconnect window expired, dropping: <sessionId>` and `[JumperRoom] disposed (<roomId>)`.
4. Re-joining creates a fresh room, not the old one.

## Automated coverage

The same scenarios are exercised in `server/src/__tests__/JumperRoom.test.ts` under the `reconnect + dropout` describe block, using a shortened 2s reconnect window via `JUMPER_RECONNECT_WINDOW_SEC=2`. Run with:

```bash
pnpm --filter @jumper/server test
```

## Coordination

QA's smoke script ([SMA-211](/SMA/issues/SMA-211)) should include at minimum Scenario 1 (reconnect) and Scenario 2 (dropout) before sign-off on the netcode hardening track.

Parent goal: [SMA-209](/SMA/issues/SMA-209).
