-- Full, idempotent setup for the `food_scores` table and the trigram index
-- that powers the fuzzy product-name lookup in lib/pipeline.ts.
--
-- Run with psql. The Neon pooler host can fail psql's SSL channel binding,
-- so use the DIRECT host (drop "-pooler" and "&channel_binding=require"):
--
--   psql "postgresql://USER:PASS@ep-...-a2sl3llj.eu-central-1.aws.neon.tech/neondb?sslmode=require" \
--     -v ON_ERROR_STOP=1 -f db/setup.sql
--
-- Or, to only (re)create the extension + index without touching the data,
-- use the runnable script instead:  pnpm db:setup

-- 1. Table (no-op if it already exists; never drops data). Column order MUST
--    match the CSV as fed to the loader. db/rebuild.sh strips the source CSV's
--    `categories` column (3rd) from the stream, so this table omits it.
CREATE TABLE IF NOT EXISTS food_scores (
  barcode          TEXT,
  product_name     TEXT,
  ecoscore_score   INTEGER,
  ecoscore_grade   TEXT,
  nutriscore_grade TEXT,
  nutriscore_score INTEGER,
  allergens        TEXT,
  co2_total_kg     DOUBLE PRECISION
);

-- 2. Load data. Commented out so re-running this file doesn't duplicate rows.
--    For a full, scripted reload from db/output.csv use `pnpm db:rebuild`
--    instead (it drops + recreates the table first). Or uncomment to load into
--    an empty table (path is relative to psql's working directory):
-- \copy food_scores FROM 'db/output.csv' CSV HEADER

-- 3. Trigram matching + KNN GiST index.
--    The lookup orders by `product_name <-> $1` (= 1 - similarity), which this
--    index can serve as an index scan instead of a full-table scan over 4.2M
--    rows (~2.3s -> ~65ms). Covers all rows since the lookup matches the
--    closest product whether or not it has an eco-score.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS food_scores_name_trgm_gist
  ON food_scores USING gist (product_name gist_trgm_ops);
