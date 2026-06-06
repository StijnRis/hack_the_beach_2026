import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { identifyProductAndBarcode } from "../../../lib/product_detect";

export async function GET() {
    // 1. Resolve the absolute path to your test image
    const imagePath = path.join(process.cwd(), "public/test-product.jpg");

    // 2. Read the file into a binary buffer asynchronously
    const imageBuffer = await fs.readFile(imagePath);

    // 3. Convert the buffer into a clean base64 string
    const base64Data = imageBuffer.toString("base64");

    // 4. Send the raw base64 data to your updated function
    const data = await identifyProductAndBarcode(base64Data, "image/jpeg");

    if (!data) {
        return NextResponse.json(
            { error: "Failed to scan image" },
            { status: 500 },
        );
    }

    return NextResponse.json({ success: true, data });
}