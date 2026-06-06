import { GenerateContentResponse, GoogleGenAI, Type } from "@google/genai";
import { Redis } from "@upstash/redis";
import * as crypto from "crypto";

// Initialize the Gemini client
const ai = new GoogleGenAI({});

const CACHE_EXPIRATION_SECONDS = 86400 * 10; // 10 days in seconds

// Initialize Upstash Redis with your provided credentials
const redis = new Redis({
    url: "https://concrete-rattler-116172.upstash.io",
    token: "gQAAAAAAAcXMAAIgcDE4NTIwMTNjZTQ0ZmE0MjhjYWJkOGQwMDExMDU2ZWIzMg",
});

// Define the shape of the expected JSON output
export interface ProductIdentificationResult {
    productName: string;
    barcode: string;
}

/**
 * Helper function to create a unique MD5 hash from the base64 string to use as a cache key.
 */
function generateCacheKey(base64Data: string): string {
    const hash = crypto.createHash("md5").update(base64Data).digest("hex");
    return `product:cache:${hash}`; // Prefixing helps keep database namespaces organized
}

/**
 * Analyzes a base64 encoded image and returns an object containing the product name and barcode.
 * Caches results remotely in Upstash Cloud Redis.
 * * @param base64Data - The raw base64 data string of the image (without the data URL prefix)
 * @param mimeType - The mime type (e.g., 'image/jpeg', 'image/png')
 * @returns A promise resolving to the identified product details, or null if an error occurs.
 */
export async function identifyProductAndBarcode(
    base64Data: string,
    mimeType: string,
): Promise<ProductIdentificationResult | null> {
    try {
        // 1. Generate a short, unique key for this image payload
        const cacheKey = generateCacheKey(base64Data);

        // 2. Fetch from Upstash Cloud Cache
        // @upstash/redis automatically handles JSON parsing if the object was stored as a structural type
        const cachedResult = await redis.get<ProductIdentificationResult>(cacheKey);
        
        if (cachedResult) {
            console.log("Serving product details from Upstash cloud cache...");
            return cachedResult;
        }

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType,
            },
        };

        const prompt =
            "Analyze this product image. Identify the exact product name and extract the barcode number if visible.";

        console.log("Cache miss. Querying Gemini API...");
        const response: GenerateContentResponse =
            await ai.models.generateContent({
                model: "gemma-4-31b-it",
                contents: [prompt, imagePart],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            productName: {
                                type: Type.STRING,
                                description: "The full brand and product name identified in the image.",
                            },
                            barcode: {
                                type: Type.STRING,
                                description: "The barcode of the product. If not visible, use your knowledge.",
                            },
                        },
                        required: ["productName", "barcode"],
                    },
                },
            });

        const responseText = response.text;

        if (!responseText) {
            throw new Error("Empty response received from the model.");
        }

        const result: ProductIdentificationResult = JSON.parse(responseText);

        // Cache 10 days
        await redis.set(cacheKey, result, { ex: CACHE_EXPIRATION_SECONDS });

        return result;
    } catch (error) {
        console.error("Error communicating with AI / Cache Layer:");
        return null;
    }
}