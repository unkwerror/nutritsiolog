#!/bin/bash
set -e

APP_DIR="/home/mun/nutritsiolog/api"

cd "$APP_DIR"

# Проверка .env
if [ ! -f .env ]; then
    echo "ERROR: .env file not found in $APP_DIR"
    exit 1
fi

echo "==> Pulling latest changes..."
git -C /home/mun/nutritsiolog pull origin main

echo "==> Installing dependencies..."
npm ci

echo "==> Building TypeScript..."
npm run build

echo "==> Running migrations..."
npm run migrate

echo "==> Pruning dev dependencies..."
npm prune --omit=dev

echo "==> Reloading processes..."
if pm2 list | grep -q "nutritsiolog-api"; then
    pm2 reload ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
    pm2 save
fi

echo "==> Done."
pm2 status
