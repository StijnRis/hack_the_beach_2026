import sharp from "sharp";
import { processAndSplitImage, RoboflowPrediction } from "./box_detection"; // Adjust import path
import { identifyProductAndBarcode } from "./product_detect"; // Adjust import path

export interface EnrichedProductResult extends Omit<
    RoboflowPrediction,
    "croppedBase64"
> {
    productName: string | null;
    barcode: string | null;
    environmentScore: number;
}

/**
 * Generates a random environment score between 1 and 100
 */
function generateEnvironmentScore(): number {
    return Math.floor(Math.random() * 100) + 1;
}

/**
 * Executes the full pipeline:
 * 1. Takes an incoming image buffer.
 * 2. Detects objects via Roboflow.
 * 3. Iterates predictions to crop snippets using Sharp.
 * 4. Sends snippets to Gemini to get names and barcodes.
 * 5. Appends a mock environment score.
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

        const environmentScore = generateEnvironmentScore();

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

            // 4. Return merged metadata, dropping the base64 string
            return {
                x: prediction.x,
                y: prediction.y,
                width: prediction.width,
                height: prediction.height,
                confidence: prediction.confidence,
                class: prediction.class,
                class_id: prediction.class_id,
                detection_id: prediction.detection_id,
                productName: aiResult?.productName ?? null,
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
                environmentScore,
            };
        }
    });

    return Promise.all(analysisPromises);
}