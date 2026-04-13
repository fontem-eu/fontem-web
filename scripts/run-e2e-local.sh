#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Run e2e tests against a fully local stack.
#
# Builds community-api + gmr-api from the sibling repo directories,
# starts Postgres + Neo4j, runs Vite dev server, and executes
# Playwright tests. Tears everything down on exit.
#
# Usage:  ./scripts/run-e2e-local.sh [playwright args...]
# Example: ./scripts/run-e2e-local.sh --grep "auth"
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

log() { echo "[local-e2e] $*"; }

# ── Cleanup on exit ─────────────────────────────────────────
cleanup() {
    log "Stopping Vite dev server..."
    kill "$VITE_PID" 2>/dev/null || true
    log "Tearing down docker-compose..."
    docker compose -f docker-compose.test.yml down -v 2>/dev/null || true
}
trap cleanup EXIT

# ── Start backend services ──────────────────────────────────
log "Building and starting backend services..."
docker compose -f docker-compose.test.yml up -d --build --wait

# Register test user (community-api auto-creates tables on startup)
log "Registering test user..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8001/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
curl -sf -X POST http://localhost:8001/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"researcher@gmr.test","password":"TestPass123!","name":"Test User"}' \
    >/dev/null 2>&1 || true  # ignore if already exists

# ── Start Vite dev server ───────────────────────────────────
log "Starting Vite dev server..."
npx vite --config vite.config.local.js --host 0.0.0.0 &
VITE_PID=$!

# Wait for Vite to be ready
for i in $(seq 1 30); do
    if curl -sf http://localhost:5173/ >/dev/null 2>&1; then
        log "Vite dev server ready"
        break
    fi
    sleep 1
done

# ── Run Playwright tests ────────────────────────────────────
log "Running e2e tests..."
BASE_URL=http://localhost:5173 npx playwright test "$@"
EXIT_CODE=$?

log "Done (exit code: $EXIT_CODE)"
exit $EXIT_CODE
