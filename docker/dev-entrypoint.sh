#!/bin/sh
set -e

echo "==> Installing dependencies..."
npm install

echo "==> Applying local D1 migrations (idempotent; existing data is preserved)..."
npx wrangler d1 migrations apply ispolandsafenow-db --local

echo "==> Building the Astro/Cloudflare worker..."
npm run build

echo "==> Starting Wrangler on 0.0.0.0:8787..."
exec npx wrangler dev --local --ip 0.0.0.0 --port 8787
