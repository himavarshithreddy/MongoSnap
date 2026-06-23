```bash
#!/bin/bash

set -e

APP_DIR="/var/www/mongosnap"
FRONTEND_DIR="$APP_DIR/apps/frontend"
BACKEND_DIR="$APP_DIR/apps/backend"

echo "🚀 Pulling latest code..."
cd "$APP_DIR"
git pull origin main

echo "📦 Installing backend dependencies..."
cd "$BACKEND_DIR"
pnpm install --frozen-lockfile

echo "🔁 Restarting backend..."
pm2 restart backend || pm2 start index.js --name backend

echo "📦 Installing frontend dependencies..."
cd "$FRONTEND_DIR"
pnpm install --frozen-lockfile

echo "⚙️ Building frontend..."
pnpm build

echo "🔐 Fixing frontend permissions..."
sudo chown -R www-data:www-data "$FRONTEND_DIR/dist"

echo "🌐 Testing Nginx configuration..."
sudo nginx -t

echo "♻️ Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment complete!"
```
