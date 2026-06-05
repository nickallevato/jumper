# Contributing to Jumper

Lightweight engineering process for everyone who touches this repo (Engineer, QA,
Artist when committing assets, CEO). This is process discipline, not a framework.

## Source of truth

- **Canonical remote:** `origin` → `https://github.com/nickallevato/jumper.git`
- **Mirror:** `gitea.allevato.io/na/jumper` (push here too if your checkout has a
  `gitea` remote; the GitHub `origin` is authoritative).
- **Default branch:** `main`. Confirm `git remote -v` shows the GitHub origin
  before you commit a line — never let work land in the wrong repo.

## The standard (non-negotiable)

### 1. Commit all code
If it exists on disk, it exists in a commit. No work-in-progress is left
uncommitted at the end of a working session/heartbeat. Commits are scoped and
message-clear, and **every commit message ends with exactly**:

```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

### 2. Push all code
Every commit is pushed to the shared remote **before** an issue is marked `done`
or `in_review`. "Done" with unpushed commits is not done. If there is no remote,
that is a first-class blocker — name it and escalate to the CEO, do not silently
keep work local.

### 3. One worktree per sprint
Each sprint / parallel unit of work runs in its own git worktree on its own
branch, isolated from `main` and from other sprints. This keeps concurrent agents
from stepping on each other and keeps `main` always buildable.

## Worktree-per-sprint workflow (exact commands)

Branch naming: `<type>/<TICKET>-<slug>` — e.g. `feat/COY-12-tandem-lift`,
`fix/COY-15-landing-snap`, `chore/COY-9-engineering-standard`.

### At sprint start — create an isolated worktree + branch

```bash
# From your existing checkout of jumper (any worktree of it):
git fetch origin

# Create a new worktree in a sibling directory, on a fresh branch off latest main:
git worktree add -b feat/COY-12-tandem-lift ../jumper-COY-12 origin/main

cd ../jumper-COY-12
pnpm install   # isolated node_modules for this worktree
```

You now have a clean, isolated working tree. Do all sprint work here.

### During the sprint — commit + push early and often

```bash
git add -A
git commit -m "feat(COY-12): tandem lift co-op verb

Co-Authored-By: Paperclip <noreply@paperclip.ing>"

# First push also sets upstream so QA/CEO can see the branch:
git push -u origin feat/COY-12-tandem-lift
```

Open a PR into `main` when the slice is review-ready. Keep the branch pushed so
reviewers always have a commit reference.

### At sprint close — tear down the worktree

```bash
# After the branch is merged/closed on the remote:
cd ../jumper                      # back to the primary checkout
git worktree remove ../jumper-COY-12
git branch -d feat/COY-12-tandem-lift   # local cleanup (use -D if not fast-forward)
git fetch --prune                 # drop stale remote-tracking refs
```

List active worktrees any time with `git worktree list`.

## Definition of Done (the gate)

An issue is not done until **all** hold:

- Tests green (`pnpm test`); new server logic has new tests.
- Build clean (`pnpm build`), no new errors.
- No regressions to movement, sync, items, or discovery.
- Server-authoritative — no new client-trusted state for anything that matters.
- Feel-checked — the slice has been played and feels right.
- Docs synced (`docs/GDD.md`, `docs/BACKLOG.md` updated to match what now exists).
- **Committed & pushed** — working tree clean, pushed to `origin`, commit/branch
  linked on the issue.

## Reviewers

QA and the CEO **reject any completion claim that lacks a pushed commit
reference.** A green local checkout is not evidence; a pushed branch + commit link
on the issue is.
