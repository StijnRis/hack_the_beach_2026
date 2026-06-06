import { runProductDetectionPipeline } from "@/lib/pipeline";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const processedProducts = await runProductDetectionPipeline();

        return NextResponse.json({
            success: true,
            count: processedProducts.length,
            data: processedProducts,
        });
    } catch (error: Error | unknown) {
        console.error("Pipeline Route Error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error.message ||
                    "An error occurred during pipeline execution.",
            },
            { status: 500 },
        );
    }
}
