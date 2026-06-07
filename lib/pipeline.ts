import { sql } from "drizzle-orm";
import sharp from "sharp";
import { processAndSplitImage, RoboflowPrediction } from "./box_detection"; // Adjust import path
import { db } from "./db";
import { identifyProductAndBarcode } from "./product_detect"; // Adjust import path
import { foodScores } from "./schema";

export interface EnrichedProductResult extends Omit<
    RoboflowPrediction,
    "croppedBase64"
> {
    productName: string | null;
    barcode: string | null;
    environmentScore: number;
}

// Neutral fallback when there's no product name to look up at all.
const DEFAULT_ENVIRONMENT_SCORE = 50;

// Score assigned when the matched product has no eco-score in the table.
const UNSCORED_ENVIRONMENT_SCORE = 30;

/**
 * Looks up the eco-score for a product name in the `food_scores` table.
 *
 * Uses Postgres trigram matching (pg_trgm) to find the single closest
 * product by name, regardless of whether it has an eco-score. If that
 * product has no eco-score we return a fixed fallback; if there's no name
 * to look up at all we return a neutral default.
 *
 * We order by the `<->` distance operator (which equals
 * `1 - similarity(...)`) instead of `similarity(...) DESC` because `<->`
 * can be served by a KNN GiST trigram index, turning a full-table scan
 * (~2.3s over 4.2M rows) into an index scan (~65ms). The ordering — and
 * therefore the chosen match — is identical. Because we now consider every
 * row (not just scored ones), the index must NOT be partial:
 *
 *   CREATE INDEX food_scores_name_trgm_gist
 *     ON food_scores USING gist (product_name gist_trgm_ops);
 */
async function getEnvironmentScore(
    productName: string | null,
): Promise<number> {
    if (!productName) return DEFAULT_ENVIRONMENT_SCORE;

    const [row] = await db
        .select({ ecoscoreScore: foodScores.ecoscoreScore })
        .from(foodScores)
        .orderBy(sql`${foodScores.productName} <-> ${productName}`)
        .limit(1);

    return row?.ecoscoreScore ?? UNSCORED_ENVIRONMENT_SCORE;
}

/**
 * Executes the full pipeline:
 * 1. Takes an incoming image buffer.
 * 2. Detects objects via Roboflow.
 * 3. Iterates predictions to crop snippets using Sharp.
 * 4. Sends snippets to Gemini to get names and barcodes.
 * 5. Looks up each product's eco-score in the `food_scores` table.
 * 6. Combines and returns metadata without base64 data.
 */
export async function runProductDetectionPipeline(
    imageBuffer: Buffer
): Promise<EnrichedProductResult[]> {
    
    // 1. Fetch raw predictions from Roboflow
    // Note: If processAndSplitImage originally relied on the local file, 
    // you may need to update its parameters to accept this buffer as well.
    const predictions = await processAndSplitImage(imageBuffer);

    // 2. Concurrently crop and analyze each prediction snippet
    const analysisPromises = predictions.map(async (prediction) => {
        const width = Math.round(prediction.width);
        const height = Math.round(prediction.height);

        // Calculate offsets from Roboflow's center points
        const left = Math.max(0, Math.round(prediction.x - width / 2));
        const top = Math.max(0, Math.round(prediction.y - height / 2));

        try {
            // Extract the object image chunk
            const croppedBuffer = await sharp(imageBuffer)
                .extract({ left, top, width, height })
                .toBuffer();

            const croppedBase64 = croppedBuffer.toString("base64");

            // 3. Query Gemini for product name and barcode
            const aiResult = await identifyProductAndBarcode(
                croppedBase64,
                "image/jpeg",
            );

            const productName = aiResult?.productName ?? null;

            // 4. Look up the real eco-score for this product in the database
            const environmentScore = await getEnvironmentScore(productName);

            // 5. Return merged metadata, dropping the base64 string
            return {
                x: prediction.x,
                y: prediction.y,
                width: prediction.width,
                height: prediction.height,
                confidence: prediction.confidence,
                class: prediction.class,
                class_id: prediction.class_id,
                detection_id: prediction.detection_id,
                productName,
                barcode: aiResult?.barcode ?? null,
                environmentScore,
            };
        } catch (error) {
            console.error(
                `Failed processing prediction ${prediction.detection_id}:`,
                error,
            );
            // Gracefully degrade so the whole request doesn't crash if one image crop/AI call fails
            return {
                ...prediction,
                productName: null,
                barcode: null,
                environmentScore: DEFAULT_ENVIRONMENT_SCORE,
            };
        }
    });

    return Promise.all(analysisPromises);
}