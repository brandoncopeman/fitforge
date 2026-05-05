import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

// PATCH — update a workout exercise, including reorder
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
  const { exercise_name, muscle_group, order_index } = body

  const rows = await sql`
    UPDATE workout_exercises we
    SET
      exercise_name = COALESCE(${exercise_name}, we.exercise_name),
      muscle_group = COALESCE(${muscle_group}, we.muscle_group),
      order_index = COALESCE(${order_index}, we.order_index)
    FROM workouts w
    WHERE we.id = ${id}
      AND we.workout_id = w.id
      AND w.user_id = ${userId}
    RETURNING we.*
  `

  if (!rows[0]) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 })
  }

  return NextResponse.json(rows[0])
}

// DELETE — remove an exercise from a workout
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
    DELETE FROM workout_exercises we
    USING workouts w
    WHERE we.id = ${id}
      AND we.workout_id = w.id
      AND w.user_id = ${userId}
  `

  return NextResponse.json({ success: true })
}