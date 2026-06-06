import { Mistral } from "@mistralai/mistralai";
import { Redis } from "@upstash/redis";
import * as crypto from "crypto";

// Array of your API keys for random selection
const MISTRAL_KEYS = [
    process.env.MISTRAL_API_KEY_1,
    process.env.MISTRAL_API_KEY_2,
].filter(Boolean) as string[];

/**
 * Helper function to pick a random API key and initialize a fresh Mistral client instance
 */
function getMistralClient(): Mistral {
    const randomIndex = Math.floor(Math.random() * MISTRAL_KEYS.length);
    const apiKey = MISTRAL_KEYS[randomIndex];
    return new Mistral({ apiKey });
}

const CACHE_EXPIRATION_SECONDS = 86400 * 10; // 10 days in seconds

// Initialize Upstash Redis
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
    return `product:cachev20260606T2324:${hash}`;
}

/**
 * Analyzes a base64 encoded image using Mistral and returns an object containing the product name and barcode.
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
        const cachedResult =
            await redis.get<ProductIdentificationResult>(cacheKey);

        if (cachedResult) {
            console.log("Serving product details from Upstash cloud cache...");
            return cachedResult;
        }

        console.log(
            "Cache miss. Instantiating Mistral client with random API key...",
        );
        const mistral = getMistralClient();

        const prompt =
            "Analyze this product image. Identify the exact and full product name.";

        // Mistral expects base64 images formatted as Data URLs inside the message content array
        const imageUrl = `data:${mimeType};base64,${base64Data}`;

        const response = await mistral.chat.complete({
            model: "ministral-3b-2512",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", imageUrl: { url: imageUrl } },
                    ],
                },
            ],
            responseFormat: {
                type: "json_schema", 
                jsonSchema: {
                    name: "ProductIdentificationResult",
                    schemaDefinition: {
                        type: "object",
                        properties: {
                            productName: {
                                type: "string",
                                description:
                                    "The full brand and product name identified in the image.",
                            },
                        },
                        required: ["productName"],
                        additionalProperties: false, // This stops the model from emitting "nonsense" fields
                    },
                },
            },
        });

        // Mistral chat completion choices can be strings or undefined
        const responseText = response.choices?.[0]?.message?.content;

        console.log(responseText);

        if (!responseText || typeof responseText !== "string") {
            throw new Error("Empty or invalid response received from Mistral.");
        }

        const result: ProductIdentificationResult = JSON.parse(responseText);

        // Cache
        await redis.set(cacheKey, result, { ex: CACHE_EXPIRATION_SECONDS });

        return result;
    } catch (error) {
        console.error("Error communicating with AI / Cache Layer:", error);
        return null;
    }
}
