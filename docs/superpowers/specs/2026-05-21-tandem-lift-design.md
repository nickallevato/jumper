# Tandem Lift — Design Spec
*2026-05-21*

> A co-op super-jump: two players co-charge a shared launch that flings them both far higher
> than any solo move, reaching ledges neither could reach alone. Built only from the existing
> jump button; server-authoritative, like head-bounce. Backlog item #42.

**Status:** design agreed in brainstorming (Section 1 explicitly approved; Sections 2–6 proposed
and checkpointed here for review). A few tuning values remain open — see "Open / tunable" below.
Next step after sign-off: `superpowers:writing-plans` to produce the implementation plan.

---

## Pillars served
- **Depth from simple verbs (2):** no new button — two players just hold jump near each other.
- **Cooperative by design (4):** requires a partner; turns head-bounce into an intentional 2-player verb.
- **Discovery is the game (1):** discoverable by accident (two players jumping together) and taught
  implicitly by an "impossible" ledge — no UI hint.
- **You are what you've done (3):** first lift grants a cosmetic to both participants.
- **Always playable, server-authoritative (6):** the server is the authority for pairing + launch.

---

## Decided design

### Core mechanic & rules (APPROVED)
- **Charging:** a player is "charging" while **grounded, not moving (no WASD), and holding Space**.
  The client sends a `charge` flag to the server on change.
- **Pairing:** the server pairs two charging players in the same room within **≤ 1.1 tiles** of each
  other and within **0.4 tz** of the same height (effectively the same surface).
- **Build-up:** while a valid pair holds the charge, a shared timer accumulates; peak at **~0.6 s**.
  If either player moves, releases Space, or leaves range, the charge **resets** (no launch).
- **Launch:** at peak the server tells **both** clients to launch → each sets `vz = TANDEM_LIFT_VEL`,
  a fixed boost reaching **~2.5 tiles** (well above the ~1.27 solo max). Both rise together.
  A per-player cooldown (~0.6 s) prevents immediate re-trigger.
- **Universal:** any two cooperating players, anywhere — not gated to special pads.

### Server logic & protocol
- **New events:**
  - `charge` (client → server): `{ charging: bool }`, sent on change.
  - `tandem` (server → client): `{ progress }` each tick while paired (drives the glow); and
    `{ launch: true, vel }` at peak.
- **Player state:** the server's per-player record gains a `charging` flag.
- **Tick loop** — `evaluateTandemLifts(io, byRoom)` beside `detectHeadBounces`:
  - find pairs in the same room, both charging, within range/height, neither on cooldown;
  - keep a `pairKey → elapsedMs` map (pairKey = sorted `idA:idB`); add `TICK_MS` each valid tick;
    delete the entry the moment a condition breaks;
  - while valid, emit `tandem { progress: elapsedMs / TANDEM_CHARGE_MS }` to both;
  - at `elapsedMs ≥ TANDEM_CHARGE_MS`: emit `tandem { launch: true, vel: TANDEM_LIFT_VEL }` to both,
    set cooldown on both, record discovery, clear the timer.

### Feel
- **Shared glow** drawn *between* the two paired players, brightening/growing with `progress`
  (0→1) and pulsing faster near peak — the tell that teaches the mechanic.
- **Launch:** stretch on both, a small upward burst, and a new ascending `Sound.lift()` whoosh
  (distinct from the head-bounce blip).

### Discovery & reward
- First successful lift records `secret_tandem` for **both** participants (server-side, action
  `tandem_lift`) → unlocks a `tandem` cosmetic (a linked/paired look). Both get the discovery
  flash + camera punch + sound. Uses the existing secrets/cosmetics pipeline (append-only cosmetic).

### Level design (teaches itself)
- Seed **one ledge at ~2.3 tz**, unreachable solo and not served by any platform — only a tandem
  lift reaches it. Put a small reward there (discovery/cosmetic). Place it where players naturally
  gather (near overworld spawn or a portal). **No marker** — the "impossible ledge" is the teacher.

### Testing
- Extract pure logic into `shared/tandem.js`: `isTandemPair(a, b)` (range + height test) and a
  charge-accumulator helper. Vitest covers: pair in range/height → true; out of range or height →
  false; charge accumulates to peak and resets on break. (Mirrors the `puzzles.js` / `doors.js`
  shared-helper + test pattern.) Tick-loop wiring covered by helpers + manual feel-check.

---

## Constants (`shared/constants.js`)
| Name | Value (initial) | Meaning |
|---|---|---|
| `TANDEM_LIFT_VEL` | tuned so apex ≈ 2.5 tiles | launch impulse for both players |
| `TANDEM_CHARGE_MS` | 600 | hold time to reach peak |
| `TANDEM_RANGE` | 1.1 | max tile distance between the pair |
| `TANDEM_Z` | 0.4 | max height difference between the pair |
| `TANDEM_COOLDOWN_MS` | 600 | per-player lockout after a launch |

`TANDEM_LIFT_VEL`: with hold-gravity off on a server-driven launch, solve from apex ≈ v²/(2·GRAVITY).
For apex ≈ 2.5 and GRAVITY = 0.022 → v ≈ 0.33. Start there and tune by feel.

---

## Open / tunable (confirm at review)
- Launch height (~2.5 tiles) and `TANDEM_CHARGE_MS` (0.6 s) — feel values, expect tuning.
- Whether the glow is fully server-driven (`tandem {progress}` per tick) vs a lighter client-only
  shimmer + server launch. Current plan: server-driven for an accurate shared tell.
- Cosmetic identity/name for `tandem` and exact teaching-ledge location.

## Out of scope (this feature)
- Three+ player stacking; directional/angled launches; tandem-only puzzle gating (pads).
- The other queued co-op/puzzle ideas (Mirror Relay, Resonance tiles) — separate design cycles.

---

## Brainstorming state — how to resume
Decisions locked via `superpowers:brainstorming`:
- Activation: **symmetric co-charge** · Who launches: **both together** · Charge: **hold-to-charge,
  auto-fire at peak** · Where: **anywhere two players cooperate** · Authority: **server-side**
  (tick-loop pairing, like head-bounce).

To continue: review this spec → on approval, invoke `superpowers:writing-plans` to create the
implementation plan, then build (TDD on `shared/tandem.js` helpers first).
