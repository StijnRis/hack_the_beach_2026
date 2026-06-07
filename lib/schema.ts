import {
    doublePrecision,
    integer,
    pgTable,
    text,
} from "drizzle-orm/pg-core";

export const foodScores = pgTable("food_scores", {
    barcode: text("barcode"),
    productName: text("product_name"),
    ecoscoreScore: integer("ecoscore_score"),
    ecoscoreGrade: text("ecoscore_grade"),
    nutriscoreGrade: text("nutriscore_grade"),
    nutriscoreScore: integer("nutriscore_score"),
    allergens: text("allergens"),
    co2TotalKg: doublePrecision("co2_total_kg"),
    categories: text("categories"), 
});
