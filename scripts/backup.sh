#!/usr/bin/env bash
# Backup database Postgres ke file terkompresi (format custom pg_dump).
# Butuh: docker + DATABASE_URL (cth. URL direct Neon).
# Pakai: DATABASE_URL='postgres://...' ./scripts/backup.sh
set -euo pipefail

: "${DATABASE_URL:?Isi DATABASE_URL dulu (pakai URL direct/non-pooled untuk Neon).}"

OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/sitester-$STAMP.dump"

# Di dalam container, localhost milik container itu sendiri → arahkan ke host.
DB_URL_FOR_DOCKER="${DATABASE_URL/localhost/host.docker.internal}"
DB_URL_FOR_DOCKER="${DB_URL_FOR_DOCKER/127.0.0.1/host.docker.internal}"

docker run --rm -i --add-host=host.docker.internal:host-gateway postgres:16-alpine pg_dump \
  --format=custom --compress=9 --no-owner --dbname="$DB_URL_FOR_DOCKER" > "$FILE"

echo "Backup tersimpan: $FILE ($(du -h "$FILE" | cut -f1))"
echo "Restore (contoh): docker run --rm -i --add-host=host.docker.internal:host-gateway -v \"\$PWD/$OUT_DIR:/b:ro\" postgres:16-alpine pg_restore --clean --if-exists -d \"\$DATABASE_URL\" /b/$(basename "$FILE")"
