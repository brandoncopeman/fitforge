import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const exerciseName = searchParams.get("name")
  if (!exerciseName) return NextResponse.json(null)

  // Find the most recent sets for this exercise name
  const rows = await sql`
    SELECT es.weight_kg, es.reps, es.set_number
    FROM exercise_sets es
    JOIN workout_exercises we ON es.workout_exercise_id = we.id
    JOIN workouts w ON we.workout_id = w.id
    WHERE w.user_id = ${userId}
      AND LOWER(we.exercise_name) = LOWER(${exerciseName})
    ORDER BY w.performed_at DESC, es.set_number ASC
    LIMIT 15
  `

  return NextResponse.json(rows)
}