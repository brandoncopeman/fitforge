import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type Params = {
  params: Promise<{
    id: string
  }>
}

type WorkoutDetailRow = {
  workout_id: string
  user_id: string
  workout_name: string | null
  workout_created_at: string
  duration_minutes: number | string | null

  workout_exercise_id: string | null
  exercise_name: string | null
  muscle_group: string | null
  order_index: number | string | null

  set_id: string | null
  set_number: number | string | null
  reps: number | string | null
  weight_kg: number | string | null
  set_duration_minutes: number | string | null
  speed: number | string | null
  distance: number | string | null
  incline: number | string | null
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(_req: Request, context: Params) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const rows = await sql`
      SELECT
        w.id AS workout_id,
        w.user_id,
        w.name AS workout_name,
        w.created_at AS workout_created_at,
        w.duration_minutes,

        we.id AS workout_exercise_id,
        we.exercise_name,
        we.muscle_group,
        we.order_index,

        es.id AS set_id,
        es.set_number,
        es.reps,
        es.weight_kg,
        es.duration_minutes AS set_duration_minutes,
        es.speed,
        es.distance,
        es.incline
      FROM workouts w
      LEFT JOIN workout_exercises we ON we.workout_id = w.id
      LEFT JOIN exercise_sets es ON es.workout_exercise_id = we.id
      WHERE w.id = ${id}
        AND w.user_id = ${userId}
      ORDER BY
        we.order_index ASC NULLS LAST,
        we.id ASC,
        es.set_number ASC NULLS LAST,
        es.id ASC
    `

    const detailRows = rows as WorkoutDetailRow[]

    if (detailRows.length === 0) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 })
    }

    const firstRow = detailRows[0]

    const exerciseMap = new Map<
      string,
      {
        id: string
        workout_id: string
        exercise_name: string
        exercise_external_id: null
        muscle_group: string | null
        order_index: number | null
        sets: {
          id: string
          workout_exercise_id: string
          set_number: number
          reps: number
          weight_kg: number
          duration_minutes: number | null
          speed: number | null
          distance: number | null
          incline: number | null
          completed: boolean
        }[]
        last_session: []
      }
    >()

    for (const row of detailRows) {
      if (!row.workout_exercise_id || !row.exercise_name) {
        continue
      }

      if (!exerciseMap.has(row.workout_exercise_id)) {
        exerciseMap.set(row.workout_exercise_id, {
          id: row.workout_exercise_id,
          workout_id: row.workout_id,
          exercise_name: row.exercise_name,
          exercise_external_id: null,
          muscle_group: row.muscle_group,
          order_index: toNumberOrNull(row.order_index),
          sets: [],
          last_session: [],
        })
      }

      const exercise = exerciseMap.get(row.workout_exercise_id)

      if (!exercise || !row.set_id) {
        continue
      }

      exercise.sets.push({
        id: row.set_id,
        workout_exercise_id: row.workout_exercise_id,
        set_number: toNumber(row.set_number, exercise.sets.length + 1),
        reps: toNumber(row.reps, 0),
        weight_kg: toNumber(row.weight_kg, 0),
        duration_minutes: toNumberOrNull(row.set_duration_minutes),
        speed: toNumberOrNull(row.speed),
        distance: toNumberOrNull(row.distance),
        incline: toNumberOrNull(row.incline),
        completed: false,
      })
    }

    const exercises = Array.from(exerciseMap.values()).map((exercise) => ({
      ...exercise,
      sets: exercise.sets.sort(
        (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
      ),
    }))

    return NextResponse.json({
      workout: {
        id: firstRow.workout_id,
        user_id: firstRow.user_id,
        name: firstRow.workout_name || "Workout",
        performed_at: firstRow.workout_created_at,
        duration_minutes: toNumberOrNull(firstRow.duration_minutes),
        notes: null,
      },
      exercises,
    })
  } catch (err) {
    console.error("Failed to load mobile workout detail", err)

    return NextResponse.json(
      {
        error: "Failed to load workout detail",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}