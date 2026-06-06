import { runProductDetectionPipeline } from "@/lib/pipeline";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("image") as File | null;

        if (!file) {
            return NextResponse.json(
                {
                    success: false,
                    error: "No image file provided in the 'image' field.",
                },
                { status: 400 },
            );
        }

        // Convert the incoming file object into a Node.js Buffer for Sharp
        const arrayBuffer = await file.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // Execute the processing pipeline with user-submitted data
        const processedProducts =
            await runProductDetectionPipeline(imageBuffer);

        return NextResponse.json({
            success: true,
            count: processedProducts.length,
            data: processedProducts,
        });
    } catch (error: any) {
        console.error("Pipeline Route Error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "An error occurred during pipeline execution.",
            },
            { status: 500 },
        );
    }
}
