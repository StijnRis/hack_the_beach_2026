import { Mistral } from "@mistralai/mistralai";
import { Redis } from "@upstash/redis";
import * as crypto from "crypto";
import { z } from "zod";

// 1. Enhanced Zod schema with field descriptions to guide the small vision model
const ProductNameResult = z.object({
    productName: z
        .string()
        .describe(
            "The exact, clean brand and product name in Dutch supermarket format. " +
                "Example: 'AH Terra Sojakwark Ongezoet' instead of 'On Terra Soja Kwark'. " +
                "Strip all price promotions, discounts, or 'X% Korting' text.",
        ),
    reasoning: z
        .string()
        .optional()
        .describe("Brief internal text clues used to identify the product."),
});

// Create an inferred type for correct TypeScript return types
export type ProductIdentification = z.infer<typeof ProductNameResult>;

const MISTRAL_KEYS = [
    process.env.MISTRAL_API_KEY_1,
    process.env.MISTRAL_API_KEY_2,
].filter(Boolean) as string[];

let currentKeyIndex = 0;

function getMistralClient(): Mistral {
    if (MISTRAL_KEYS.length === 0) {
        throw new Error(
            "No Mistral API keys provided in environment variables.",
        );
    }

    const apiKey = MISTRAL_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % MISTRAL_KEYS.length;

    return new Mistral({ apiKey });
}

class RateLimiter {
    private maxRequestsPerSecond = 20;
    private requestTimestamps: number[] = [];
    private queue: (() => void)[] = [];
    private processing = false;

    async acquire(): Promise<void> {
        const startTime = Date.now();
        let executedImmediately = false;

        return new Promise<void>((resolve) => {
            const wrappedResolve = () => {
                executedImmediately = true;
                resolve();
            };

            this.queue.push(wrappedResolve);
            this.processQueue();

            if (!executedImmediately) {
                const queuePosition = this.queue.length;
                console.warn(
                    `[RateLimiter] Request delayed due to limit. Current queue depth: ${queuePosition}`,
                );

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
                nextResolve();
            }
        }

        this.processing = false;

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

const apiLimiter = new RateLimiter();
const CACHE_EXPIRATION_SECONDS = 86400 * 10; // 10 days

// Initialize Upstash Redis safely via environment URL if possible
const redis = new Redis({
    url:
        process.env.UPSTASH_REDIS_REST_URL ||
        "https://concrete-rattler-116172.upstash.io",
    token: process.env.REDIS_TOKEN!,
});

function generateCacheKey(base64Data: string): string {
    const hash = crypto.createHash("md5").update(base64Data).digest("hex");
    return `product:cachev9:${hash}`; // Bumped version to invalidate old messy cache entries
}

/**
 * Analyzes a base64 encoded image using Ministral and returns a clean product name.
 * Grounded specifically for retail store checkout execution in the Netherlands.
 */
export async function identifyProduct(
    base64Data: string,
    mimeType: string,
): Promise<ProductIdentification | null> {
    try {
        const cacheKey = generateCacheKey(base64Data);
        const cachedResult = await redis.get<ProductIdentification>(cacheKey);

        if (cachedResult) {
            return cachedResult;
        }

        console.log("Using Mistral API...");

        await apiLimiter.acquire();
        const mistral = getMistralClient();

        // Grounding prompt targeting specific Dutch inventory catalog structures
        const structuredPrompt = `You are a precise POS checkout scanner operating in Dutch supermarkets (e.g., Albert Heijn, Jumbo, Lidl, Plus, Aldi).
Analyze the product image and output its exact real-world commercial name.

Rules:
1. Fix common logo optical illusions: Recognize Albert Heijn's house label "AH Terra" instead of reading fragments as "On Terra", "Cn Terra", or "Tera".
2. Match typical Dutch receipt or webshop taxonomy (e.g., "AH Terra Kokos Gurt", "Oatly Haverdrank Barista", "Coca-Cola Original Taste").
3. Strictly normalize formatting: Clean up typos, remove discount markers like "35% Korting", "Voordeelverpakking", or structural layout phrases.
4. Output nothing except the requested JSON schema fields.`;

        const imageUrl = `data:${mimeType};base64,${base64Data}`;

        const response = await mistral.chat.parse({
            model: "ministral-3b-2512",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: structuredPrompt },
                        { type: "image_url", imageUrl: { url: imageUrl } },
                    ],
                },
            ],
            responseFormat: ProductNameResult,
            temperature: 0, // Enforces deterministic extraction rather than creative guessing
        });

        const responseText = response.choices?.[0]?.message?.content;

        if (!responseText || typeof responseText !== "string") {
            throw new Error("Empty or invalid response received from Mistral.");
        }

        const result: ProductIdentification = JSON.parse(responseText);

        if (!result.productName) {
            throw new Error("Mistral did not return a product name.");
        }

        // Cache the clean result back to Upstash Redis
        await redis.set(cacheKey, result, { ex: CACHE_EXPIRATION_SECONDS });

        return result;
    } catch (error) {
        console.error("Error communicating with AI / Cache Layer:", error);
        return null;
    }
}
