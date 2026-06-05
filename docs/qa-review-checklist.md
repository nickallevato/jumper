# QA Review Checklist

The gate QA runs before passing **any** code or asset issue. An issue is not
"done" until every item below holds. This checklist operationalizes the
Engineering Standard in [`CONTRIBUTING.md`](../CONTRIBUTING.md) and the green
gates in [`quality-bar.md`](./quality-bar.md).

QA verifies two gates, not one: **green** (it builds and tests pass) and **feel**
(movement plays right). Both must pass.

## 0. Pushed-commit gate — REJECT FIRST (hard blocker)

Check this **before** spending any time on the green or feel gates. If it fails,
the completion claim is **auto-rejected** and review stops here.

- [ ] A branch **and** commit SHA are **pushed to the canonical remote**
      `origin` → `github.com/nickallevato/jumper` (mirror:
      `gitea.allevato.io/na/jumper`), and linked on the issue.
- [ ] The pushed commit is the one the completion claim refers to (the linked
      SHA actually exists on the remote — `git fetch origin && git cat-file -t <sha>`,
      or open it on GitHub).
- [ ] The commit message ends with **exactly**:
      `Co-Authored-By: Paperclip <noreply@paperclip.ing>`

**A green *local* checkout is NOT sufficient evidence.** An unpushed / local-only
completion is auto-rejected regardless of how clean it looks on the author's
machine. "Done" with unpushed commits is not done. If there is genuinely no
remote, that is a first-class blocker — name it and escalate to the CEO; do not
pass the issue.

## 1. Green gate

- [ ] `bash scripts/smoke.sh` passes (typecheck + server tests + client build).
- [ ] New server logic has new tests; tests assert behavior, not just state.
- [ ] No regressions to movement, sync, items, or discovery.
- [ ] Server-authoritative — no new client-trusted state for anything that matters.

## 2. Feel gate

- [ ] The slice was actually played at a real viewport (solo, and with a second
      client where multiplayer matters) — not just asserted in a test.
- [ ] Movement feels good to perform repeatedly: variable jump arcs read right,
      squash-and-stretch lands on impact, coyote time forgives correctly.
- [ ] The local player is predicted/reconciled smoothly and is **never
      hard-snapped** to a server tick.
- [ ] Co-op / head-bounce moments actually trigger and feel earned.
- [ ] Evidence captured for anything UI- or feel-visible (screenshot/recording),
      with secrets/PII redacted.

## 3. Docs & disposition

- [ ] Docs synced (GDD / backlog updated to match what now exists).
- [ ] QA records exact steps run, expected vs actual, and a clear PASS/FAIL on
      **both** gates. On FAIL, hand back with concrete repro steps and which gate
      failed.

---

**Rule of record:** QA and the CEO **reject any completion claim that lacks a
pushed commit reference.** A pushed branch + commit link on the issue is the
evidence; a green local checkout is not. See `CONTRIBUTING.md` → "Definition of
Done" and "Reviewers."
