import { integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Mirrors the `food_scores` table populated from output.csv:
 *
 *   CREATE TABLE food_scores (
 *     product_name     TEXT,
 *     ecoscore_score   INTEGER,
 *     nutriscore_grade TEXT,
 *     nutriscore_score INTEGER,
 *     allergens        TEXT
 *   );
 *   \COPY food_scores FROM 'output.csv' CSV HEADER;
 *
 * KNN GiST trigram index that makes the fuzzy name lookup in
 * `getEnvironmentScore` (lib/pipeline.ts) use an index scan instead of a
 * full-table scan. Partial on scored rows since that's all the query reads:
 *
 *   CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *   CREATE INDEX food_scores_name_trgm_gist
 *     ON food_scores USING gist (product_name gist_trgm_ops)
 *     WHERE ecoscore_score IS NOT NULL;
 */
export const foodScores = pgTable("food_scores", {
    productName: text("product_name"),
    ecoscoreScore: integer("ecoscore_score"),
    nutriscoreGrade: text("nutriscore_grade"),
    nutriscoreScore: integer("nutriscore_score"),
    allergens: text("allergens"),
});
