#!/usr/bin/env bash
# scripts/reset-demo.sh
# ─────────────────────────────────────────────────────────────
# Full demo reset: wipe DB data, re-seed, flush Redis.
# Usage: bash scripts/reset-demo.sh [--skip-redis]
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/apps/backend"

REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
SKIP_REDIS=false

for arg in "$@"; do
  case "$arg" in
    --skip-redis) SKIP_REDIS=true ;;
  esac
done

echo "═══════════════════════════════════════════════════"
echo "  Hau CEX — Demo Reset"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "═══════════════════════════════════════════════════"
echo ""

# ── 1. Reset DB ──────────────────────────────────────────────
echo "[1/3] Resetting database..."
cd "${BACKEND_DIR}"

# Run prisma db push (apply schema without migration history reset)
./node_modules/.bin/prisma db push --accept-data-loss --skip-generate

# Re-seed
echo "      Seeding database..."
npx tsx prisma/seed.ts

echo "      ✅ Database reset complete"

# ── 2. Flush Redis ───────────────────────────────────────────
if [ "${SKIP_REDIS}" = false ]; then
  echo ""
  echo "[2/3] Flushing Redis streams and caches..."

  # Delete known stream keys
  redis-cli -u "${REDIS_URL}" DEL \
    stream:engine:commands \
    stream:engine:events \
    stream:market:events \
    stream:dead-letter \
    > /dev/null

  # Delete orderbook cache keys (pattern-based)
  OB_KEYS=$(redis-cli -u "${REDIS_URL}" --scan --pattern "cache:orderbook:*" 2>/dev/null || true)
  if [ -n "${OB_KEYS}" ]; then
    echo "${OB_KEYS}" | xargs redis-cli -u "${REDIS_URL}" DEL > /dev/null
    echo "      Deleted orderbook cache keys"
  fi

  # Delete engine sequence keys
  SEQ_KEYS=$(redis-cli -u "${REDIS_URL}" --scan --pattern "seq:*" 2>/dev/null || true)
  if [ -n "${SEQ_KEYS}" ]; then
    echo "${SEQ_KEYS}" | xargs redis-cli -u "${REDIS_URL}" DEL > /dev/null
  fi

  echo "      ✅ Redis flush complete"
else
  echo ""
  echo "[2/3] Skipping Redis flush (--skip-redis)"
fi

# ── 3. Summary ───────────────────────────────────────────────
echo ""
echo "[3/3] Reset complete!"
echo ""
echo "  Test accounts (password: 123456):"
echo "    alice@haucex.com  — USDT: 7000 avail / 3000 locked | BTC: 0.5 avail"
echo "    bob@haucex.com    — USDT: 5000 avail / 1998 locked | BTC: 0.5 avail"
echo "    admin@haucex.com  — no wallets"
echo ""
echo "═══════════════════════════════════════════════════"
