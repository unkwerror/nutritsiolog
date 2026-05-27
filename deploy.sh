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

echo "==> Cleaning dist..."
rm -rf dist

echo "==> Building TypeScript..."
npm run build

echo "==> Running migrations..."
npm run migrate

echo "==> Pruning dev dependencies..."
npm prune --omit=dev

echo "==> Restarting processes..."
pm2 delete ecosystem.config.cjs 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "==> Done."
pm2 status
