import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  try {
    const res = await fetch("https://exercisedb.p.rapidapi.com/exercises/bodyPartList", {
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
      },
      next: { revalidate: 86400 }, // cache for 24 hours
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    // Fallback list if API fails
    return NextResponse.json(["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"])
  }
}