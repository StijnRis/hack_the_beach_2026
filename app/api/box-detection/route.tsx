import { processAndSplitImage } from "@/lib/box_detection";
import { NextResponse } from "next/server";

export async function GET() {
    const data = await processAndSplitImage();
    return NextResponse.json({ data });
}
