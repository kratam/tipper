#!/usr/bin/env bash
# Seed script: realistic match odds feltöltése dev DB-be
# Használat: ./scripts/seed-dev-odds.sh
# Idempotens: csak azon meccsekre szúr be, ahol még nincs odds.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.local"

# .env.local olvasása
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Hiba: .env.local nem található: $ENV_FILE" >&2
  exit 1
fi

# DATABASE_URL kinyerése (nem PROD_DATABASE_URL!)
DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)

if [[ -z "$DB_URL" ]]; then
  echo "Hiba: DATABASE_URL hiányzik a .env.local-ból." >&2
  exit 1
fi

# Figyelmeztetés ha véletlenül prod URL-t tartalmaz
if echo "$DB_URL" | grep -q "ancient-term"; then
  echo "FIGYELEM: A DATABASE_URL úgy tűnik, a prod adatbázisra mutat!" >&2
  echo "Biztosan folytatod? (igen/nem)" >&2
  read -r confirm
  [[ "$confirm" == "igen" ]] || exit 1
fi

PSQL=$(command -v psql || command -v /opt/homebrew/opt/libpq/bin/psql 2>/dev/null || echo "")
if [[ -z "$PSQL" ]]; then
  echo "Hiba: psql nem található. Telepítsd: brew install libpq" >&2
  exit 1
fi

echo "Odds seed futtatása..."
"$PSQL" "$DB_URL" -f "$SCRIPT_DIR/seed-dev-odds.sql" -v ON_ERROR_STOP=1

echo "Kész."
