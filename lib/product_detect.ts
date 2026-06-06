import { Mistral } from "@mistralai/mistralai";
import { Redis } from "@upstash/redis";
import * as crypto from "crypto";

// Array of your API keys for selection
const MISTRAL_KEYS = [
    process.env.MISTRAL_API_KEY_1,
    process.env.MISTRAL_API_KEY_2,
].filter(Boolean) as string[];

// Round-robin index counter for perfect rotation
let currentKeyIndex = 0;

/**
 * Helper function to pick the NEXT API key in strict sequential rotation
 * and initialize a fresh Mistral client instance.
 */
function getMistralClient(): Mistral {
    if (MISTRAL_KEYS.length === 0) {
        throw new Error(
            "No Mistral API keys provided in environment variables.",
        );
    }

    // Smoothly cycle through keys using modulo arithmetic
    const apiKey = MISTRAL_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % MISTRAL_KEYS.length;

    return new Mistral({ apiKey });
}

/**
 * Simple token-bucket style rate limiter queue to handle exactly 20 calls/sec max.
 * Queues up overflow tasks transparently.
 */
class RateLimiter {
    private maxRequestsPerSecond = 20;
    private requestTimestamps: number[] = [];
    private queue: (() => void)[] = [];
    private processing = false;

    /**
     * Enqueues a task and returns a promise that resolves when the task is allowed to execute.
     * Logs if the request was delayed due to rate limiting.
     */
    async acquire(): Promise<void> {
        const startTime = Date.now();
        let executedImmediately = false;

        return new Promise<void>((resolve) => {
            // Wrap resolve to detect if execution happens instantly vs later
            const wrappedResolve = () => {
                executedImmediately = true;
                resolve();
            };

            this.queue.push(wrappedResolve);
            this.processQueue();

            // If it didn't resolve immediately during processQueue, it's being delayed
            if (!executedImmediately) {
                const queuePosition = this.queue.length;
                console.warn(
                    `[RateLimiter] Request delayed due to limit. Current queue depth: ${queuePosition}`,
                );

                // Override resolve to log the actual wait duration when it finally runs
                const originalResolve = resolve;
                resolve = () => {
                    const delayDuration = Date.now() - startTime;
                    console.log(
                        `[RateLimiter] Delayed request released after waiting ${delayDuration}ms.`,
                    );
                    originalResolve();
                };
            }
        });
    }

    private processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const now = Date.now();
        // Clean out timestamps older than 1 second
        this.requestTimestamps = this.requestTimestamps.filter(
            (t) => now - t < 1000,
        );

        while (
            this.queue.length > 0 &&
            this.requestTimestamps.length < this.maxRequestsPerSecond
        ) {
            const nextResolve = this.queue.shift();
            if (nextResolve) {
                this.requestTimestamps.push(Date.now());
                nextResolve(); // Execute the task
            }
        }

        this.processing = false;

        // If items are still queued up, schedule the next queue check
        if (this.queue.length > 0) {
            const oldestTimestamp = this.requestTimestamps[0] || now;
            const timeUntilNextSlot = Math.max(
                0,
                1000 - (Date.now() - oldestTimestamp),
            );
            setTimeout(() => this.processQueue(), timeUntilNextSlot);
        }
    }
}

// Global instance of our token bucket rate limiter
const apiLimiter = new RateLimiter();

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
 * Caches results remotely in Upstash Cloud Redis. Rate limits the underlying API to 20 req/sec max.
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

        // 2. Fetch from Upstash Cloud Cache (No rate limit applies here!)
        const cachedResult =
            await redis.get<ProductIdentificationResult>(cacheKey);

        if (cachedResult) {
            console.log("Serving product details from Upstash cloud cache...");
            return cachedResult;
        }

        console.log(
            "Cache miss. Waiting for a rate-limit slot before calling Mistral API...",
        );

        // 3. Rate limiting kicks in ONLY for Cache Misses
        await apiLimiter.acquire();

        console.log(
            "Slot acquired! Instantiating Mistral client with sequentially rotated API key...",
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
                        additionalProperties: false,
                    },
                },
            },
        });

        // Mistral chat completion choices can be strings or undefined
        const responseText = response.choices?.[0]?.message?.content;

        if (!responseText || typeof responseText !== "string") {
            throw new Error("Empty or invalid response received from Mistral.");
        }

        const result: ProductIdentificationResult = JSON.parse(responseText);

        // Cache the newly resolved result back to Redis
        await redis.set(cacheKey, result, { ex: CACHE_EXPIRATION_SECONDS });

        return result;
    } catch (error) {
        console.error("Error communicating with AI / Cache Layer:", error);
        return null;
    }
}
