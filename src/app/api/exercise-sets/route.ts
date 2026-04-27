import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

// POST — log a set
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const body = await req.json()
  const { workout_exercise_id, set_number, reps, weight_kg } = body

  const rows = await sql`
    INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight_kg)
    VALUES (${workout_exercise_id}, ${set_number}, ${reps}, ${weight_kg})
    RETURNING *
  `

  return NextResponse.json(rows[0])
}