#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

echo "=== Jumper Smoke Test ==="
echo ""

# 1. Unit tests (vitest)
echo "[1/2] Tests"
npm test || fail "Tests failed"
pass "Tests"

# 2. Client build (vite)
echo "[2/2] Client build"
npm run build || fail "Client build failed"
pass "Client build"

echo ""
echo "=== All checks passed ==="
