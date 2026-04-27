import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  // Get the search query from the URL e.g. /api/exercises/search?q=bench
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q")?.trim()

  if (!query || query.length < 2) return NextResponse.json([])

  try {
    const response = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(query)}?limit=10&offset=0`,
      {
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
          "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
        },
        // Cache results for 1 hour so we don't burn through our 100/day limit
        next: { revalidate: 3600 },
      }
    )

    if (!response.ok) {
      return NextResponse.json({ error: "Exercise search failed" }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Exercise search failed" }, { status: 500 })
  }
}