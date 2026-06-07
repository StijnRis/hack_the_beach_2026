import {
    doublePrecision,
    integer,
    pgTable,
    text,
} from "drizzle-orm/pg-core";

/**
 * Mirrors the `food_scores` table, loaded from db/output.csv (generated
 * from the Open Food Facts JSONL export). db/rebuild.sh strips the CSV's
 * `categories` column from the stream before loading (it's unused and was the
 * heaviest column); the remaining columns map positionally, since
 * `\copy ... CSV HEADER` ignores the header names:
 *
 *   CREATE TABLE food_scores (
 *     barcode          TEXT,
 *     product_name     TEXT,
 *     ecoscore_score   INTEGER,
 *     ecoscore_grade   TEXT,
 *     nutriscore_grade TEXT,
 *     nutriscore_score INTEGER,
 *     allergens        TEXT,
 *     co2_total_kg     DOUBLE PRECISION
 *   );
 *
 * Rebuild table + data + index in one shot: `pnpm db:rebuild`.
 *
 * KNN GiST trigram index that makes the fuzzy name lookup in
 * `getEnvironmentScore` (lib/pipeline.ts) use an index scan instead of a
 * full-table scan. Covers all rows since the lookup matches the closest
 * product whether or not it has an eco-score:
 *
 *   CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *   CREATE INDEX food_scores_name_trgm_gist
 *     ON food_scores USING gist (product_name gist_trgm_ops);
 */
export const foodScores = pgTable("food_scores", {
    barcode: text("barcode"),
    productName: text("product_name"),
    ecoscoreScore: integer("ecoscore_score"),
    ecoscoreGrade: text("ecoscore_grade"),
    nutriscoreGrade: text("nutriscore_grade"),
    nutriscoreScore: integer("nutriscore_score"),
    allergens: text("allergens"),
    co2TotalKg: doublePrecision("co2_total_kg"),
});
