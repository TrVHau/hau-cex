#!/bin/sh
set -e

echo "[entrypoint:api] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint:api] Starting backend API..."
exec node dist/api/main-api.js
