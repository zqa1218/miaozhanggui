#!/usr/bin/env bash
set -e

PROJECT_DIR="/www/wwwroot/miazhanggui.xyz"

echo "=== [1/6] Verifying environment ==="
cd "$PROJECT_DIR"

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "ERROR: not on main branch (current: $BRANCH). Abort."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: uncommitted changes present. Stashing them."
  git stash --include-untracked
fi

echo "=== [2/6] Pulling latest code ==="
git pull origin main

DEPLOYED_SHA=$(git rev-parse HEAD)
echo "Deploying commit: $DEPLOYED_SHA"

echo "=== [3/7] Installing backend dependencies ==="
npm ci

echo "=== [4/7] Backing up database (before migration) ==="
set -a
. "$PROJECT_DIR/.env" 2>/dev/null || true
set +a
mkdir -p "$PROJECT_DIR/backups"
BACKUP_FILE="$PROJECT_DIR/backups/miaozhanggui_pre_deploy_$(date +%Y%m%d_%H%M%S).sql"
mysqldump --host="${MYSQL_HOST:-127.0.0.1}" --port="${MYSQL_PORT:-3306}" \
  --user="${MYSQL_USER}" --password="${MYSQL_PASSWORD}" \
  --single-transaction --no-tablespaces "${MYSQL_DATABASE}" > "$BACKUP_FILE" 2>/dev/null \
  && echo "Backup saved: $BACKUP_FILE" || echo "WARNING: database backup failed, continuing"

echo "=== [5/7] Running database migrations ==="
npx knex migrate:latest --env production

echo "=== [6/7] Building frontend ==="
cd "$PROJECT_DIR/frontend"
npm ci
npm run build

echo "=== [7/7] Reloading PM2 (zero-downtime) ==="
pm2 reload "$PROJECT_DIR/ecosystem.config.js"

echo "=== Deploy complete ==="
echo "Deployed commit: $DEPLOYED_SHA"
pm2 status
