import { processAndSplitImage } from "@/lib/box_detection";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";

export async function GET() {
    // Resolve the exact absolute path to the public directory
    const imagePath = path.join(process.cwd(), "public", "schap.jpeg");

    const imageBuffer = await fs.readFile(imagePath);
    const data = await processAndSplitImage(imageBuffer);

    return NextResponse.json({ data });
}
