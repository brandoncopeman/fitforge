import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type WorkoutHistoryRow = {
  id: string
  name: string | null
  created_at: string
  duration_minutes: number | string | null
  exercise_count: number | string | null
  set_count: number | string | null
  volume: number | string | null
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const rows = await sql`
    SELECT
      w.id,
      w.name,
      w.created_at,
      w.duration_minutes,
      COUNT(DISTINCT we.id)::int AS exercise_count,
      COUNT(es.id)::int AS set_count,
      COALESCE(
        SUM(
          COALESCE(es.weight_kg, 0)::numeric *
          COALESCE(es.reps, 0)::numeric
        ),
        0
      ) AS volume
    FROM workouts w
    LEFT JOIN workout_exercises we ON we.workout_id = w.id
    LEFT JOIN exercise_sets es ON es.workout_exercise_id = we.id
    WHERE w.user_id = ${userId}
      AND w.duration_minutes IS NOT NULL
    GROUP BY w.id
    ORDER BY w.created_at DESC
    LIMIT 100
  `

  const workouts = (rows as WorkoutHistoryRow[]).map((workout) => ({
    id: workout.id,
    name: workout.name || "Workout",
    performed_at: workout.created_at,
    duration_minutes:
      workout.duration_minutes === null || workout.duration_minutes === undefined
        ? null
        : toNumber(workout.duration_minutes),
    exercise_count: toNumber(workout.exercise_count),
    set_count: toNumber(workout.set_count),
    completed_set_count: toNumber(workout.set_count),
    volume: toNumber(workout.volume),
  }))

  return NextResponse.json({
    workouts,
  })
}