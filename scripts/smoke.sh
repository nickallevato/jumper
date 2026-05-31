#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

echo "=== Jumper Smoke Test ==="
echo ""

# 1. Typecheck
echo "[1/4] Typecheck (all packages)"
pnpm run typecheck || fail "Typecheck failed"
pass "Typecheck"

# 2. Build shared (required by server + client)
echo "[2/4] Build shared package"
pnpm --filter @jumper/shared run build || fail "Shared build failed"
pass "Shared build"

# 3. Server tests
echo "[3/4] Server tests"
pnpm --filter @jumper/server run test || fail "Server tests failed"
pass "Server tests"

# 4. Client build
echo "[4/4] Client build"
pnpm --filter @jumper/client run build || fail "Client build failed"
pass "Client build"

echo ""
echo "=== All checks passed ==="
