export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)

    const query = searchParams.get("q")

    if (!query) {
        return Response.json(
            { error: "Missing query parameter q" },
            { status: 400 }
        )
    }

    const response = await fetch(
        `https://search.openfoodfacts.org/search?q=${encodeURIComponent(
            query
        )}&page_size=10&page=1`
    )

    if (!response.ok) {
        return Response.json(
            { error: "Failed to fetch products" },
            { status: response.status }
        )
    }

    const data = await response.json()

    return Response.json(data)
}