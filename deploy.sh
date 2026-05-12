#!/bin/bash
set -e

cd /home/mun/nutritsiolog/api

echo "Pulling latest changes..."
git pull

echo "Installing dependencies..."
npm ci

echo "Building..."
npm run build

echo "Pruning dev dependencies..."
npm prune --omit=dev

echo "Reloading processes..."
pm2 reload ecosystem.config.cjs --update-env

echo "Done."
pm2 status
