import { NextResponse } from "next/server"
import sql from "@/lib/db"

const BODY_PARTS = ["back", "cardio", "chest", "lower arm", "lower leg", "neck", "shoulder", "upper arm", "upper leg", "waist"]

export async function GET() {
  try {
    let saved = 0

    for (const part of BODY_PARTS) {
      const response = await fetch(
        `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(part)}?limit=100&offset=0`,
        {
          headers: {
            "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
            "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
          },
        }
      )

      if (!response.ok) continue

      const data = await response.json()
      if (!Array.isArray(data)) continue

      for (const ex of data) {
        await sql`
          INSERT INTO exercises (id, name, body_part, target, equipment)
          VALUES (${ex.id}, ${ex.name}, ${ex.bodyPart}, ${ex.target}, ${ex.equipment})
          ON CONFLICT (id) DO NOTHING
        `
        saved++
      }
    }

    return NextResponse.json({ success: true, saved })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}