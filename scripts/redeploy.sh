#!/usr/bin/env bash
# Auto-redeploy script: pulls latest code and rebuilds/restarts containers
# Safe to call from webhook. Uses a lock to avoid concurrent runs.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCK_FILE="$REPO_DIR/.redeploy.lock"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/redeploy_$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

echo "[redeploy] $(date -Is) starting" | tee -a "$LOG_FILE"

# Acquire lock
exec 99>"$LOCK_FILE" || { echo "[redeploy] cannot open lock file" | tee -a "$LOG_FILE"; exit 1; }
if ! flock -n 99; then
  echo "[redeploy] another deployment is in progress, exiting" | tee -a "$LOG_FILE"
  exit 0
fi

cd "$REPO_DIR"

# Ensure clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[redeploy] working tree has local changes; aborting to avoid conflicts" | tee -a "$LOG_FILE"
  exit 1
fi

# Fetch and check if updates are available
DEFAULT_BRANCH=${DEFAULT_BRANCH:-main}
REMOTE=${REMOTE:-origin}

echo "[redeploy] fetching from $REMOTE" | tee -a "$LOG_FILE"
git fetch "$REMOTE" >> "$LOG_FILE" 2>&1

LOCAL=$(git rev-parse "$DEFAULT_BRANCH")
REMOTE_HEAD=$(git rev-parse "$REMOTE/$DEFAULT_BRANCH")

if [ "$LOCAL" = "$REMOTE_HEAD" ]; then
  echo "[redeploy] repo already up to date ($LOCAL)" | tee -a "$LOG_FILE"
  exit 0
fi

echo "[redeploy] pulling latest ($LOCAL -> $REMOTE_HEAD)" | tee -a "$LOG_FILE"
git pull "$REMOTE" "$DEFAULT_BRANCH" >> "$LOG_FILE" 2>&1

# Rebuild and restart with compose
COMPOSE_CMD="docker compose"
if ! docker compose version > /dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
fi

# Build images and recreate containers
echo "[redeploy] building images" | tee -a "$LOG_FILE"
$COMPOSE_CMD build --no-cache >> "$LOG_FILE" 2>&1

echo "[redeploy] starting services" | tee -a "$LOG_FILE"
$COMPOSE_CMD up -d --remove-orphans >> "$LOG_FILE" 2>&1

# Optional: prune old images (safe-ish)
# docker image prune -f >> "$LOG_FILE" 2>&1 || true

echo "[redeploy] $(date -Is) done" | tee -a "$LOG_FILE"
