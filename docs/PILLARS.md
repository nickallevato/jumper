# Jumper — Design Pillars & Quality Bar

The north-star principles. Every backlog item and every iteration is checked against these.
If a change violates a pillar, it doesn't ship — even if it works.

---

## Pillars

1. **Discovery is the game.**
   No hints, no tutorials, no quest markers. Mechanics are hidden; mastery is earned by
   experimenting. The trigger table is server-only and never revealed to the client.

2. **Depth from simple verbs.**
   One primary verb (jump) plus combinations and timing — not more buttons. New depth comes
   from how existing inputs interact (variable height, coyote, wall kick, pogo, head bounce),
   not from adding controls.

3. **You are what you've done.**
   Identity and cosmetics reflect what a player has discovered or where they've been. Never
   purchasable, never freely chosen. Your appearance is a record, not a selection.

4. **Cooperative by design.**
   Some of the best moments require another player (head bounce, mirror relay). The world
   rewards coordination between strangers who can't even chat.

5. **Feel before features.**
   A mechanic ships only when it feels good to perform repeatedly. Tuning a jump beats adding
   a new system. Movement is the product.

6. **Always playable, server-authoritative.**
   Every iteration ends in a shippable, running build. The server is the authority for all
   game state; the client renders and predicts but never decides.

---

## Quality Bar (Definition of Done for an iteration)

An iteration is **done** only when all of these hold:

- [ ] **Tests green** — `npm test` passes; new server logic has new tests.
- [ ] **Build clean** — `npm run build` succeeds with no new errors.
- [ ] **No regressions** — existing mechanics still work (movement, sync, items, discovery).
- [ ] **Server-authoritative** — no new client-trusted state for anything that matters.
- [ ] **Feel-checked** — the human reviewer has played the slice and confirmed it feels right.
- [ ] **Docs synced** — GDD.md and BACKLOG.md updated to match what now exists.
- [ ] **Committed & pushed** — working tree clean, on `origin/master`.

---

## Anti-goals (out of scope for v1, per GDD)

Chat / text comms · PvP combat · crafting · account recovery · mobile/touch · map editor / UGC.

If a backlog idea drifts into one of these, it's cut, not deferred.
