import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { processAndSplitImage, RoboflowPrediction } from "./box_detection"; // Adjust import path
import { identifyProductAndBarcode } from "./product_detect"; // Adjust import path

export interface EnrichedProductResult extends Omit<
    RoboflowPrediction,
    "croppedBase64"
> {
    productName: string | null;
    barcode: string | null;
}

/**
 * Executes the full pipeline:
 * 1. Detects objects via Roboflow.
 * 2. Iterates predictions to crop snippets using Sharp.
 * 3. Sends snippets to Gemini to get names and barcodes.
 * 4. Combines and returns metadata without base64 data.
 */
export async function runProductDetectionPipeline(): Promise<
    EnrichedProductResult[]
> {
    const filePath = path.join(process.cwd(), "public", "schap.jpeg");
    const buffer = await fs.readFile(filePath);

    // 1. Fetch raw predictions from Roboflow
    const predictions = await processAndSplitImage();

    // 2. Concurrently crop and analyze each prediction snippet
    const analysisPromises = predictions.map(async (prediction) => {
        const width = Math.round(prediction.width);
        const height = Math.round(prediction.height);

        // Calculate offsets from Roboflow's center points
        const left = Math.max(0, Math.round(prediction.x - width / 2));
        const top = Math.max(0, Math.round(prediction.y - height / 2));

        try {
            // Extract the object image chunk
            const croppedBuffer = await sharp(buffer)
                .extract({ left, top, width, height })
                .toBuffer();

            const croppedBase64 = croppedBuffer.toString("base64");

            // 3. Query Gemini for product name and barcode
            // Assuming image format is jpeg based on file path, adjust if dynamic
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
            };
        }
    });

    return Promise.all(analysisPromises);
}
