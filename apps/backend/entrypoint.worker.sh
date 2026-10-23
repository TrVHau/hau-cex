#!/bin/sh
set -e

echo "[entrypoint:worker] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint:worker] Starting backend Worker..."
exec node dist/worker/main-worker.js
