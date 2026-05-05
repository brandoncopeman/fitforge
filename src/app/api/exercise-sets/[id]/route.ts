import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const {
    reps,
    weight_kg,
    duration_minutes,
    speed,
    distance,
    incline,
  } = body

  const rows = await sql`
    UPDATE exercise_sets es
    SET
      reps = COALESCE(${reps}, es.reps),
      weight_kg = COALESCE(${weight_kg}, es.weight_kg),
      duration_minutes = COALESCE(${duration_minutes}, es.duration_minutes),
      speed = COALESCE(${speed}, es.speed),
      distance = COALESCE(${distance}, es.distance),
      incline = COALESCE(${incline}, es.incline)
    FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE es.id = ${id}
      AND es.workout_exercise_id = we.id
      AND w.user_id = ${userId}
    RETURNING es.*
  `

  if (!rows[0]) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 })
  }

  return NextResponse.json(rows[0])
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { id } = await params

  await sql`
    DELETE FROM exercise_sets es
    USING workout_exercises we, workouts w
    WHERE es.id = ${id}
      AND es.workout_exercise_id = we.id
      AND we.workout_id = w.id
      AND w.user_id = ${userId}
  `

  return NextResponse.json({ success: true })
}