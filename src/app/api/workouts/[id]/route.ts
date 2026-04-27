import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

// GET — fetch a single workout with all its exercises and sets
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { id } = await params

  // Get the workout
  const workoutRows = await sql`
    SELECT * FROM workouts 
    WHERE id = ${id} AND user_id = ${userId}
  `

  if (workoutRows.length === 0) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 })
  }

  // Get exercises in this workout
  const exercises = await sql`
    SELECT * FROM workout_exercises
    WHERE workout_id = ${id}
    ORDER BY order_index ASC
  `

  // Get sets for each exercise
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exerciseIds = exercises.map((e: any) => e.id)

  const sets = exercises.length > 0
    ? await sql`
        SELECT * FROM exercise_sets
        WHERE workout_exercise_id = ANY(${exerciseIds})
        ORDER BY set_number ASC
      `
    : []

  // Combine exercises with their sets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exercisesWithSets = exercises.map((exercise: any) => ({
    ...exercise,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sets: sets.filter((s: any) => s.workout_exercise_id === exercise.id),
  }))

  return NextResponse.json({
    workout: workoutRows[0],
    exercises: exercisesWithSets,
  })
}

// PATCH — update a workout (e.g. mark as finished, set duration)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { duration_minutes, name, notes } = body

  const rows = await sql`
    UPDATE workouts
    SET 
      duration_minutes = COALESCE(${duration_minutes}, duration_minutes),
      name = COALESCE(${name}, name),
      notes = COALESCE(${notes}, notes)
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `

  return NextResponse.json(rows[0])
}

// DELETE — delete a workout
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { id } = await params

  await sql`
    DELETE FROM workouts WHERE id = ${id} AND user_id = ${userId}
  `

  return NextResponse.json({ success: true })
}