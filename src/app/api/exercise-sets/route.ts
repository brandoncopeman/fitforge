import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

// POST — log a set
export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json()
  const {
    workout_exercise_id,
    set_number,
    reps,
    weight_kg,
    duration_minutes,
    speed,
    distance,
    incline,
  } = body

  const ownership = await sql`
    SELECT we.id
    FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE we.id = ${workout_exercise_id}
      AND w.user_id = ${userId}
    LIMIT 1
  `

  if (!ownership[0]) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 })
  }

  const rows = await sql`
    INSERT INTO exercise_sets (
      workout_exercise_id,
      set_number,
      reps,
      weight_kg,
      duration_minutes,
      speed,
      distance,
      incline
    )
    VALUES (
      ${workout_exercise_id},
      ${set_number},
      ${reps ?? null},
      ${weight_kg ?? null},
      ${duration_minutes ?? null},
      ${speed ?? null},
      ${distance ?? null},
      ${incline ?? null}
    )
    RETURNING *
  `

  return NextResponse.json(rows[0])
}