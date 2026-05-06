import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type WorkoutRow = {
  id: string
  name: string | null
  created_at: string
  duration_minutes: number | string | null
}

type WorkoutExerciseRow = {
  id: string
  workout_id: string
  exercise_name: string
  muscle_group: string | null
  order_index: number | string | null
}

type ExerciseSetRow = {
  id: string
  workout_exercise_id: string
  set_number: number | string | null
  reps: number | string | null
  weight_kg: number | string | null
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

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const [workoutRows, exerciseRows, setRows] = await Promise.all([
    sql`
      SELECT
        id,
        name,
        created_at,
        duration_minutes
      FROM workouts
      WHERE user_id = ${userId}
        AND duration_minutes IS NOT NULL
      ORDER BY created_at ASC
    `,

    sql`
      SELECT
        we.id,
        we.workout_id,
        we.exercise_name,
        we.muscle_group,
        we.order_index
      FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE w.user_id = ${userId}
        AND w.duration_minutes IS NOT NULL
      ORDER BY w.created_at ASC, we.order_index ASC NULLS LAST, we.id ASC
    `,

    sql`
      SELECT
        es.id,
        es.workout_exercise_id,
        es.set_number,
        es.reps,
        es.weight_kg
      FROM exercise_sets es
      JOIN workout_exercises we ON we.id = es.workout_exercise_id
      JOIN workouts w ON w.id = we.workout_id
      WHERE w.user_id = ${userId}
        AND w.duration_minutes IS NOT NULL
      ORDER BY es.set_number ASC NULLS LAST, es.id ASC
    `,
  ])

  const setsByExercise = (setRows as ExerciseSetRow[]).reduce<
    Record<string, ExerciseSetRow[]>
  >((map, set) => {
    if (!map[set.workout_exercise_id]) {
      map[set.workout_exercise_id] = []
    }

    map[set.workout_exercise_id].push(set)
    return map
  }, {})

  const exercisesByWorkout = (exerciseRows as WorkoutExerciseRow[]).reduce<
    Record<string, WorkoutExerciseRow[]>
  >((map, exercise) => {
    if (!map[exercise.workout_id]) {
      map[exercise.workout_id] = []
    }

    map[exercise.workout_id].push(exercise)
    return map
  }, {})

  const workouts = (workoutRows as WorkoutRow[]).map((workout) => ({
    id: workout.id,
    name: workout.name || "Workout",
    created_at: workout.created_at,
    duration_minutes: toNumberOrNull(workout.duration_minutes),
    exercises: (exercisesByWorkout[workout.id] ?? []).map((exercise) => ({
      id: exercise.id,
      workout_id: exercise.workout_id,
      exercise_name: exercise.exercise_name,
      muscle_group: exercise.muscle_group,
      order_index: toNumberOrNull(exercise.order_index),
      sets: (setsByExercise[exercise.id] ?? []).map((set) => ({
        id: set.id,
        workout_exercise_id: set.workout_exercise_id,
        set_number: toNumber(set.set_number, 1),
        reps: toNumber(set.reps, 0),
        weight_kg: toNumber(set.weight_kg, 0),
      })),
    })),
  }))

  return NextResponse.json({
    workouts,
  })
}