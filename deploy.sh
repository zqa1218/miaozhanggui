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

echo "=== [3/6] Installing backend dependencies ==="
npm ci

echo "=== [4/6] Running database migrations ==="
npx knex migrate:latest --env production

echo "=== [5/6] Building frontend ==="
cd "$PROJECT_DIR/frontend"
npm ci
npm run build

echo "=== [6/6] Reloading PM2 (zero-downtime) ==="
pm2 reload "$PROJECT_DIR/ecosystem.config.js"

echo "=== Deploy complete ==="
echo "Deployed commit: $DEPLOYED_SHA"
pm2 status
