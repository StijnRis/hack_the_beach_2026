-- Destructive, from-scratch rebuild of the food_scores table (schema only).
--
-- This file just DROPs + recreates the table and the pg_trgm extension.
-- db/rebuild.sh then bulk-loads db/output.csv and builds the trigram index;
-- the data load lives in the shell script because psql's \copy can't take the
-- CSV path from a variable, and \copy FROM STDIN inside a -f script reads the
-- script itself, not piped stdin.
--
-- Driven by `pnpm db:rebuild`. Don't run by hand unless you mean to wipe the
-- table (it has no dedup key, so a fresh load must start empty).

DROP TABLE IF EXISTS food_scores;

-- Column order MUST match the CSV as fed to the loader, which maps columns
-- positionally (`\copy ... CSV HEADER` ignores the header names). db/rebuild.sh
-- strips the source CSV's 3rd column (`categories`) from the stream before
-- loading, so this table omits it and the remaining columns still line up.
CREATE TABLE food_scores (
  barcode          TEXT,
  product_name     TEXT,
  ecoscore_score   INTEGER,
  ecoscore_grade   TEXT,
  nutriscore_grade TEXT,
  nutriscore_score INTEGER,
  allergens        TEXT,
  co2_total_kg     DOUBLE PRECISION
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
