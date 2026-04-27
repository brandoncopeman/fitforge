import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

// POST — add an exercise to a workout
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const body = await req.json()
  const { workout_id, exercise_name, exercise_external_id, muscle_group, order_index } = body

  // Make sure the workout belongs to this user
  const workoutCheck = await sql`
    SELECT id FROM workouts WHERE id = ${workout_id} AND user_id = ${userId}
  `
  if (workoutCheck.length === 0) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 })
  }

  const rows = await sql`
    INSERT INTO workout_exercises (workout_id, exercise_name, exercise_external_id, muscle_group, order_index)
    VALUES (${workout_id}, ${exercise_name}, ${exercise_external_id || null}, ${muscle_group || null}, ${order_index || 0})
    RETURNING *
  `

  return NextResponse.json(rows[0])
}