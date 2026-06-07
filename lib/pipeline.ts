import { isNotNull, sql } from "drizzle-orm";
import sharp from "sharp";
import { processAndSplitImage, RoboflowPrediction } from "./box_detection"; // Adjust import path
import { db } from "./db";
import { identifyProductAndBarcode } from "./product_detect"; // Adjust import path
import { foodScores } from "./schema";

export interface EnrichedProductResult extends RoboflowPrediction {
    productName: string | null;
    environmentScore: number | null;
    nutriScore: number | null;
    allergens: string | null;
    databaseLookupDurationMs: number;
}

async function getScores(productName: string | null) {
    if (!productName)
        return {
            environmentScore: null,
            nutriScore: null,
            allergens: null,
            databaseLookupDurationMs: 0,
        };

    const startTime = Date.now();
    const [row] = await db
        .select({
            environmentScore: foodScores.ecoscoreScore,
            productName: foodScores.productName,
            nutriScore: foodScores.nutriscoreScore,
            allergens: foodScores.allergens,
        })
        .from(foodScores)
        .where(isNotNull(foodScores.ecoscoreScore))
        .orderBy(sql`${foodScores.productName} <-> ${productName}`)
        .limit(1);
    const duration = Date.now() - startTime;

    return {
        environmentScore: row?.environmentScore ?? null,
        nutriScore: row?.nutriScore ?? null,
        allergens: row?.allergens ?? null,
        databaseLookupDurationMs: duration,
    };
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
    imageBuffer: Buffer,
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
            const scores = await getScores(productName);

            // 5. Return merged metadata, dropping the base64 string
            const item: EnrichedProductResult = {
                x: prediction.x,
                y: prediction.y,
                width: prediction.width,
                height: prediction.height,
                confidence: prediction.confidence,
                class: prediction.class,
                class_id: prediction.class_id,
                detection_id: prediction.detection_id,
                productName,
                environmentScore: scores.environmentScore,
                nutriScore: scores.nutriScore,
                allergens: scores.allergens,
                databaseLookupDurationMs: scores.databaseLookupDurationMs,
            };
            return item;
        } catch (error) {
            console.error(
                `Failed processing prediction ${prediction.detection_id}:`,
                error,
            );
            // Gracefully degrade so the whole request doesn't crash if one image crop/AI call fails
            return {
                ...prediction,
                productName: null,
                environmentScore: null,
                nutriScore: null,
                allergens: null,
                databaseLookupDurationMs: 0,
            };
        }
    });

    return Promise.all(analysisPromises);
}
