#!/bin/sh
set -eu

if [ -n "${DATA_DIR:-}" ]; then
  mkdir -p "$DATA_DIR"
elif mkdir -p /data 2>/dev/null && [ -w /data ]; then
  DATA_DIR=/data
else
  DATA_DIR="$(pwd)/data-runtime"
  mkdir -p "$DATA_DIR"
fi

mkdir -p "$DATA_DIR/sessions" "$DATA_DIR/uploads/residents"
export DATA_DIR
export DATABASE_URL="${DATABASE_URL:-file:$DATA_DIR/branner.db}"
export SESSION_DIR="${SESSION_DIR:-$DATA_DIR/sessions}"
export UPLOADS_DIR="${UPLOADS_DIR:-$DATA_DIR/uploads}"

npx prisma db push --skip-generate
exec node dist-server/index.js
