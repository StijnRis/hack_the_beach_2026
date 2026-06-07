import { isNotNull, sql } from "drizzle-orm";
import sharp from "sharp";
import { processAndSplitImage, RoboflowPrediction } from "./box_detection";
import { db } from "./db";
import { identifyProductAndBarcode } from "./product_detect";
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
        };
    }

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

    return {
        productName: row?.productName ?? null,
        environmentScore: row?.environmentScore ?? null,
        nutriScore: row?.nutriScore ?? null,
        allergens: row?.allergens ?? null,
        databaseLookupDurationMs: Date.now() - startTime,
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
            (await identifyProductAndBarcode(croppedBase64, "image/jpeg"))
                ?.productName ?? null;

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
                croppedBase64: croppedBase64,
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
