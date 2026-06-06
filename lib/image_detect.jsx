import { NextResponse } from "next/server";

export async function POST(request) {
  const filePath = path.join(process.cwd(), "public", "schap.jpeg");
  const buffer = await fs.readFile(filePath);
  const base64 = buffer.toString("base64");

  const res = await fetch(
    `https://serverless.roboflow.com/sku-110k/2?api_key=${process.env.ROBOFLOW_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: base64,
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}
