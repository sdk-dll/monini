#!/usr/bin/env bash
# Start backend.py (FastAPI) and the Next.js admin together.
# Usage: ./dev.sh [--backend-only] [--admin-only]
#
# The admin password is read from the environment (see .env.example) and is
# the same credential backend.py validates for its API.
set -euo pipefail

cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

VENV=.venv
PY="$VENV/bin/python"
BACKEND_PORT="${BACKEND_PORT:-8099}"
ADMIN_PORT="${ADMIN_PORT:-3000}"

# Admin password: explicit override → monini device password.
ADMIN_PASS="${MONINI_ADMIN_PASS:-${HUAWEI_PASS:-}}"
if [[ -z "$ADMIN_PASS" ]]; then
  echo "× MONINI_ADMIN_PASS is not set (see .env.example)" >&2
  exit 1
fi
export MONINI_ADMIN_USER="${MONINI_ADMIN_USER:-admin}"
export MONINI_ADMIN_PASS="$ADMIN_PASS"

if [[ ! -x "$PY" ]]; then
  echo "→ creating venv"
  python3 -m venv "$VENV"
  "$PY" -m pip install -q -r requirements.txt
fi

run_backend=false
run_admin=false
case "${1:-all}" in
  --backend-only) run_backend=true ;;
  --admin-only) run_admin=true ;;
  *) run_backend=true; run_admin=true ;;
esac

pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

if $run_backend; then
  echo "→ backend  http://127.0.0.1:$BACKEND_PORT"
  HUAWEI_POLL_INTERVAL="${HUAWEI_POLL_INTERVAL:-60}" \
    "$PY" backend.py --host 127.0.0.1 --port "$BACKEND_PORT" &
  pids+=($!)
fi

if $run_admin; then
  sleep 1
  echo "→ admin    http://localhost:$ADMIN_PORT"
  (
    cd admin
    if [[ ! -d node_modules ]]; then
      echo "→ installing admin dependencies"
      npm install --no-audit --no-fund
    fi
    npm run dev -- -p "$ADMIN_PORT"
  ) &
  pids+=($!)
fi

wait
