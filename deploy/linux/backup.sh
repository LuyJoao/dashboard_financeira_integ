#!/usr/bin/env bash
# Backup do PostgreSQL. Lê a DATABASE_URL do backend/.env.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${DEST:-/var/backups/pagamentos}"   # ideal: outro disco
MANTER=14
mkdir -p "$DEST"
URL=$(grep -E '^DATABASE_URL=' "$DIR/backend/.env" | cut -d= -f2- | sed 's/+psycopg//')
pg_dump -F c -f "$DEST/pagamentos_$(date +%Y%m%d_%H%M).dump" --dbname="$URL"
ls -1t "$DEST"/*.dump | tail -n +$((MANTER + 1)) | xargs -r rm --
