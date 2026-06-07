#!/usr/bin/env sh
# Full rebuild of the food_scores table from db/output.csv:
# DROPs + recreates the table, bulk-loads the CSV, rebuilds the trigram index.
#
# Reuses DATABASE_URL from .env but rewrites it to the DIRECT (non-pooler) host,
# because psql can't negotiate SSL channel binding through the Neon pooler.
#
# Usage:  pnpm db:rebuild
set -e

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CSV="$ROOT/db/output.csv"
SQL="$ROOT/db/rebuild.sql"

if [ ! -f "$CSV" ]; then
  echo "ERROR: $CSV not found. Place output.csv in the db/ directory." >&2
  exit 1
fi

URL=$(grep -E '^DATABASE_URL=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '\r')
if [ -z "$URL" ]; then
  echo "ERROR: DATABASE_URL not found in $ROOT/.env" >&2
  exit 1
fi

# Direct host: drop the "-pooler" suffix and the channel_binding requirement.
DIRECT=$(printf '%s' "$URL" | sed -E 's/-pooler//; s/[&?]channel_binding=require//')

echo "WARNING: this DROPs and reloads the entire food_scores table from:"
echo "  $CSV"

# 1. (Re)create the table + pg_trgm extension. No data load here: psql's \copy
#    can't take the CSV path via a variable.
psql "$DIRECT" -v ON_ERROR_STOP=1 -f "$SQL"

# 2. Bulk-load the CSV. \copy reads the file from this process's stdin, so we
#    pipe it in. (\copy FROM STDIN inside a -f script would read the script
#    itself, not the pipe, which is why this is a separate -c invocation.)
#    A CSV-aware filter rewrites the stream before loading:
#      - drops the 3rd column (categories): unused by the app and the heaviest
#        column, removed to stay under Neon's storage limit;
#      - strips stray NUL bytes (mangled multibyte chars in a few product names)
#        that COPY otherwise rejects with "extra data after last column".
#    csv.reader/writer also re-quotes correctly, so embedded commas/newlines in
#    the remaining fields survive.
echo "Loading $CSV (dropping categories column) ..."
python3 -c '
import csv, sys
clean = (line.replace("\x00", "") for line in sys.stdin)
reader = csv.reader(clean)
writer = csv.writer(sys.stdout, lineterminator="\n")
for row in reader:
    if len(row) >= 9:
        del row[2]  # categories
    writer.writerow(row)
' < "$CSV" | psql "$DIRECT" -v ON_ERROR_STOP=1 \
  -c "\copy food_scores FROM STDIN CSV HEADER"

# 3. Build the KNN GiST trigram index (covers all rows) and report what landed.
psql "$DIRECT" -v ON_ERROR_STOP=1 \
  -c "CREATE INDEX IF NOT EXISTS food_scores_name_trgm_gist \
        ON food_scores USING gist (product_name gist_trgm_ops)" \
  -c "SELECT count(*) AS total_rows, \
             count(*) FILTER (WHERE ecoscore_score IS NOT NULL) AS scored_rows \
      FROM food_scores"

echo "Rebuild complete."
