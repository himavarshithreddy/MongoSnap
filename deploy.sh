#!/bin/bash

set -e

APP_DIR="/var/www/mongosnap"
FRONTEND_DIR="$APP_DIR/apps/frontend"
BACKEND_DIR="$APP_DIR/apps/backend"

echo "🚀 Pulling latest code..."
cd "$APP_DIR"

git reset --hard HEAD
git clean -fd
git pull origin main

echo "📦 Installing backend dependencies..."
cd "$BACKEND_DIR"
pnpm install --frozen-lockfile

echo "🔁 Restarting backend..."
if pm2 describe backend >/dev/null 2>&1; then
    pm2 restart backend
else
    pm2 start index.js --name backend
fi

echo "📦 Installing frontend dependencies..."
cd "$FRONTEND_DIR"
pnpm install --frozen-lockfile

echo "🧹 Cleaning previous build..."
sudo rm -rf "$FRONTEND_DIR/dist"

echo "🔐 Fixing frontend permissions..."
sudo chown -R ubuntu:ubuntu "$FRONTEND_DIR"

echo "⚙️ Building frontend..."
pnpm build

echo "📂 Setting frontend permissions..."
sudo chmod -R 755 "$FRONTEND_DIR/dist"

echo "🌐 Testing Nginx configuration..."
sudo nginx -t

echo "♻️ Reloading Nginx..."
sudo systemctl reload nginx

echo "💾 Saving PM2 processes..."
pm2 save

echo "✅ Deployment complete!"
