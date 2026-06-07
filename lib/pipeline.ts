import { isNotNull, sql } from "drizzle-orm"; // Assuming you are using Drizzle ORM based on the syntax
import sharp from "sharp";
import { processAndSplitImage, RoboflowPrediction } from "./box_detection";
import { db } from "./db";
import { identifyProduct } from "./product_detect";
import { foodScores } from "./schema";

export interface EnrichedProductResult extends RoboflowPrediction {
    detectedProductName: string | null;
    dbProductName: string | null;
    environmentScore: number | null;
    nutriScore: number | null;
    allergens: string | null;
    databaseLookupDurationMs: number;
    debug: object;
    link: string | null;
}

async function getScores(productName: string | null) {
    if (!productName) {
        return {
            productName: null,
            environmentScore: null,
            nutriScore: null,
            allergens: null,
            databaseLookupDurationMs: 0,
            debug: {},
        };
    }

    const startTime = Date.now();

    // 1. First, try to find the absolute closest match (even if environmentScore is null)
    const [exactRow] = await db
        .select({
            environmentScore: foodScores.ecoscoreScore,
            productName: foodScores.productName,
            nutriScore: foodScores.nutriscoreScore,
            allergens: foodScores.allergens,
            categories: foodScores.categories,
        })
        .from(foodScores)
        .orderBy(sql`${foodScores.productName} <-> ${productName}`)
        .limit(1);

    // If we found a match and it already has an environment score, we are good to go!
    if (exactRow && exactRow.environmentScore !== null) {
        return {
            productName: exactRow.productName ?? null,
            environmentScore: exactRow.environmentScore ?? null,
            nutriScore: exactRow.nutriScore ?? null,
            allergens: exactRow.allergens ?? null,
            databaseLookupDurationMs: Date.now() - startTime,
            debug: {
                usedFallback: false,
            },
        };
    }

    // 2. FALLBACK: The closest match didn't have an environmentScore.
    // We look for the closest item that DOES have a score, factoring in both name and category similarity.
    const referenceCategories = exactRow?.categories || "";

    const [fallbackRow] = await db
        .select({
            environmentScore: foodScores.ecoscoreScore,
            productName: foodScores.productName,
            nutriScore: foodScores.nutriscoreScore,
            allergens: foodScores.allergens,
            categories: foodScores.categories,
        })
        .from(foodScores)
        .where(isNotNull(foodScores.ecoscoreScore)) // Force it to find a row with a score
        .orderBy(
            // Order by name distance first, but add a weight for category similarity if categories exist
            sql`${foodScores.productName} <-> ${productName} + (CASE WHEN ${referenceCategories} != '' THEN (${foodScores.categories} <-> ${referenceCategories}) * 0.5 ELSE 0 END)`,
        )
        .limit(1);

    // Use fallback data for the environment score, but keep the original closest match's details if preferred.
    // Here we return the fallback row's data to ensure consistency.
    const finalRow = fallbackRow || exactRow;

    return {
        productName: finalRow?.productName ?? null,
        environmentScore: finalRow?.environmentScore ?? null,
        nutriScore: finalRow?.nutriScore ?? null,
        allergens: finalRow?.allergens ?? null,
        databaseLookupDurationMs: Date.now() - startTime,
        debug: {
            usedFallback: !!fallbackRow,
            exactMatch: {
                productName: exactRow?.productName ?? null,
            },
        },
    };
}

// Deduplicate concurrent lookups for identical products
const scoreCache = new Map<
    string,
    Promise<Awaited<ReturnType<typeof getScores>>>
>();

function getScoresCached(productName: string | null) {
    if (!productName) {
        return getScores(null);
    }

    let promise = scoreCache.get(productName);

    if (!promise) {
        promise = getScores(productName);
        scoreCache.set(productName, promise);
    }

    return promise;
}

async function processPrediction(
    sourceImage: sharp.Sharp,
    prediction: RoboflowPrediction,
): Promise<EnrichedProductResult> {
    const width = Math.round(prediction.width);
    const height = Math.round(prediction.height);

    const left = Math.max(0, Math.round(prediction.x - width / 2));

    const top = Math.max(0, Math.round(prediction.y - height / 2));

    try {
        const croppedBase64 = (
            await sourceImage
                .clone()
                .extract({
                    left,
                    top,
                    width,
                    height,
                })
                .jpeg()
                .toBuffer()
        ).toString("base64");

        const productName =
            (await identifyProduct(croppedBase64, "image/jpeg"))?.productName ??
            null;

        const scores = await getScoresCached(productName);

        return {
            ...prediction,
            detectedProductName: productName,
            dbProductName: scores.productName,
            environmentScore: scores.environmentScore,
            nutriScore: scores.nutriScore,
            allergens: scores.allergens,
            databaseLookupDurationMs: scores.databaseLookupDurationMs,
            debug: {
                scoreDebug: scores.debug,
            },
            link: null,
        };
    } catch (error) {
        console.error(
            `Failed processing prediction ${prediction.detection_id}:`,
            error,
        );

        return {
            ...prediction,
            detectedProductName: null,
            dbProductName: null,
            environmentScore: null,
            nutriScore: null,
            allergens: null,
            databaseLookupDurationMs: 0,
            debug: {},
            link: null,
        };
    }
}

/**
 * Full parallel pipeline.
 */
export async function runProductDetectionPipeline(
    imageBuffer: Buffer,
): Promise<EnrichedProductResult[]> {
    const predictions = await processAndSplitImage(imageBuffer);

    const sourceImage = sharp(imageBuffer);

    try {
        return await Promise.all(
            predictions.map((prediction) =>
                processPrediction(sourceImage, prediction),
            ),
        );
    } finally {
        scoreCache.clear();
    }
}
