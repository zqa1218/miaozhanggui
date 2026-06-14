#!/usr/bin/env bash
set -e

PROJECT_DIR="/www/wwwroot/miazhanggui.xyz"

echo "=== [1/5] Pulling latest code ==="
cd "$PROJECT_DIR"
git pull origin main

echo "=== [2/5] Installing backend dependencies ==="
npm ci

echo "=== [3/5] Running database migrations ==="
npx knex migrate:latest --env production

echo "=== [4/5] Building frontend ==="
cd "$PROJECT_DIR/frontend"
npm ci
npm run build

echo "=== [5/5] Reloading PM2 (zero-downtime) ==="
pm2 reload "$PROJECT_DIR/ecosystem.config.js"

echo "=== Deploy complete ==="
pm2 status
