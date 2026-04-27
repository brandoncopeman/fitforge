import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const part = searchParams.get("part")
  if (!part) return NextResponse.json([])

  try {
    const res = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(part)}?limit=50&offset=0`,
      {
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
          "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
        },
        next: { revalidate: 3600 },
      }
    )
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}