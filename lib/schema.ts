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
 */
export const foodScores = pgTable("food_scores", {
    productName: text("product_name"),
    ecoscoreScore: integer("ecoscore_score"),
    nutriscoreGrade: text("nutriscore_grade"),
    nutriscoreScore: integer("nutriscore_score"),
    allergens: text("allergens"),
});
