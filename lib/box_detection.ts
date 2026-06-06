import fs from "node:fs/promises";
import path from "node:path";

export interface RoboflowPrediction {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    class: string;
    class_id: number;
    detection_id: string;
}

export interface RoboflowResponse {
    inference_id: string;
    time: number;
    image: {
        width: number;
        height: number;
    };
    predictions: RoboflowPrediction[];
}

/**
 * Core processor to handle Roboflow communication
 */
export async function processAndSplitImage(imageBuffer: Buffer): Promise<RoboflowPrediction[]> {
    const base64 = imageBuffer.toString("base64");

    const apiKey = process.env.ROBOFLOW_API_KEY;
    if (!apiKey) {
        throw new Error("Missing ROBOFLOW_API_KEY environment variable");
    }

    // Fetch data from Roboflow
    const res = await fetch(
        `https://serverless.roboflow.com/sku-110k/2?api_key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: base64,
        },
    );

    if (!res.ok) {
        throw new Error(`Roboflow API responded with status: ${res.status}`);
    }

    const data = (await res.json()) as RoboflowResponse;
    return data.predictions;
}