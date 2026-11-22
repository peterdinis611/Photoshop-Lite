#!/usr/bin/env bash
# PhotoshopLite — start Redis (optional) + API + editor in one go.
#
# Usage:
#   ./scripts/dev.sh              # redis + bun run dev
#   ./scripts/dev.sh --no-redis   # skip docker redis
#   ./scripts/dev.sh --install    # bun install first
#   ./scripts/dev.sh --stop       # stop redis container only
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[0;33m'
CYN='\033[0;36m'
NC='\033[0m'

log()  { printf "${CYN}==>${NC} %s\n" "$*"; }
ok()   { printf "${GRN}✓${NC}  %s\n" "$*"; }
warn() { printf "${YLW}!${NC}  %s\n" "$*"; }
err()  { printf "${RED}✗${NC}  %s\n" "$*" >&2; }

DO_INSTALL=0
SKIP_REDIS=0
STOP_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --install|-i) DO_INSTALL=1 ;;
    --no-redis)   SKIP_REDIS=1 ;;
    --stop)       STOP_ONLY=1 ;;
    -h|--help)
      cat <<'EOF'
PhotoshopLite — start Redis (optional) + API + editor

  ./scripts/dev.sh              redis + bun run dev
  ./scripts/dev.sh --no-redis   skip docker redis
  ./scripts/dev.sh --install    bun install first
  ./scripts/dev.sh --stop       stop redis container only

  bun run dev:all               same as ./scripts/dev.sh
EOF
      exit 0
      ;;
    *)
      err "Unknown flag: $arg (try --help)"
      exit 1
      ;;
  esac
done

ensure_env() {
  if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
      cp .env.example .env
      ok "Created .env from .env.example — edit API keys if needed"
    else
      warn "No .env or .env.example found"
    fi
  fi

  # Prefer Redis URL when we start redis; don't overwrite a custom value.
  if [[ -f .env ]] && ! grep -q '^REDIS_URL=' .env 2>/dev/null; then
    echo 'REDIS_URL=redis://127.0.0.1:6379' >> .env
    ok "Appended REDIS_URL to .env"
  elif [[ -f .env ]] && grep -q '^REDIS_URL=$' .env 2>/dev/null; then
    # empty REDIS_URL= → fill local default
    if sed --version >/dev/null 2>&1; then
      sed -i 's|^REDIS_URL=$|REDIS_URL=redis://127.0.0.1:6379|' .env
    else
      sed -i '' 's|^REDIS_URL=$|REDIS_URL=redis://127.0.0.1:6379|' .env
    fi
    ok "Set empty REDIS_URL to redis://127.0.0.1:6379"
  fi
}

compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo ""
  fi
}

start_redis() {
  local dc
  dc="$(compose_cmd)"
  if [[ -z "$dc" ]]; then
    warn "Docker Compose not found — API will use in-memory cache/throttle"
    return 0
  fi

  if ! docker info >/dev/null 2>&1; then
    warn "Docker daemon not running — skip Redis (memory fallback)"
    return 0
  fi

  log "Starting Redis (docker compose)…"
  # shellcheck disable=SC2086
  $dc up -d redis

  # Wait until healthy / pingable (max ~20s)
  local i=0
  while (( i < 40 )); do
    if $dc exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
      ok "Redis ready on :6379"
      return 0
    fi
    sleep 0.5
    i=$((i + 1))
  done
  warn "Redis did not become ready in time — continuing anyway"
}

stop_redis() {
  local dc
  dc="$(compose_cmd)"
  if [[ -z "$dc" ]]; then
    err "Docker Compose not found"
    exit 1
  fi
  log "Stopping Redis…"
  # shellcheck disable=SC2086
  $dc stop redis
  ok "Redis stopped"
}

ensure_bun() {
  if ! command -v bun >/dev/null 2>&1; then
    err "bun is required (https://bun.sh)"
    exit 1
  fi
}

ensure_deps() {
  if [[ "$DO_INSTALL" -eq 1 ]] || [[ ! -d node_modules ]]; then
    log "Installing dependencies (bun install)…"
    bun install
    ok "Dependencies installed"
  fi
}

print_banner() {
  cat <<EOF

${GRN}PhotoshopLite${NC}  editor :4200 · api :3001 · redis :6379 (optional)

  Ctrl+C stops editor + API. Redis keeps running (./scripts/dev.sh --stop).

EOF
}

if [[ "$STOP_ONLY" -eq 1 ]]; then
  stop_redis
  exit 0
fi

ensure_bun
ensure_env
ensure_deps

if [[ "$SKIP_REDIS" -eq 0 ]]; then
  start_redis
else
  warn "Skipping Redis (--no-redis)"
fi

print_banner
log "Starting editor + API (turbo)…"
exec bun run dev
