import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type Params = {
  params: Promise<{
    id: string
  }>
}

type WorkoutRow = {
  id: string
  user_id: string
  name: string | null
  performed_at: string
  duration_minutes: number | string | null
  notes: string | null
}

type WorkoutExerciseRow = {
  id: string
  workout_id: string
  exercise_name: string
  exercise_external_id: string | null
  muscle_group: string | null
  order_index: number | string | null
}

type ExerciseSetRow = {
  id: string
  workout_exercise_id: string
  set_number: number | string
  reps: number | string | null
  weight_kg: number | string | null
  duration_minutes: number | string | null
  speed: number | string | null
  distance: number | string | null
  incline: number | string | null
  created_at: string
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(_req: Request, context: Params) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { id } = await context.params

  const workoutRows = await sql`
    SELECT
      id,
      user_id,
      name,
      performed_at,
      duration_minutes,
      notes
    FROM workouts
    WHERE id = ${id}
      AND user_id = ${userId}
    LIMIT 1
  `

  const workout = workoutRows[0] as WorkoutRow | undefined

  if (!workout) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 })
  }

  const exerciseRows = await sql`
    SELECT
      id,
      workout_id,
      exercise_name,
      exercise_external_id,
      muscle_group,
      order_index
    FROM workout_exercises
    WHERE workout_id = ${id}
    ORDER BY order_index ASC NULLS LAST, id ASC
  `

  const workoutExerciseIds = (exerciseRows as WorkoutExerciseRow[]).map(
    (exercise) => exercise.id
  )

  const setRows =
    workoutExerciseIds.length > 0
      ? await sql`
          SELECT
            id,
            workout_exercise_id,
            set_number,
            reps,
            weight_kg,
            duration_minutes,
            speed,
            distance,
            incline,
            created_at
          FROM exercise_sets
          WHERE workout_exercise_id = ANY(${workoutExerciseIds})
          ORDER BY set_number ASC, created_at ASC
        `
      : []

  const setsByExercise = (setRows as ExerciseSetRow[]).reduce<
    Record<string, ExerciseSetRow[]>
  >((map, set) => {
    if (!map[set.workout_exercise_id]) {
      map[set.workout_exercise_id] = []
    }

    map[set.workout_exercise_id].push(set)
    return map
  }, {})

  const exercises = (exerciseRows as WorkoutExerciseRow[]).map((exercise) => ({
    id: exercise.id,
    workout_id: exercise.workout_id,
    exercise_name: exercise.exercise_name,
    exercise_external_id: exercise.exercise_external_id,
    muscle_group: exercise.muscle_group,
    order_index: toNumberOrNull(exercise.order_index),
    sets: (setsByExercise[exercise.id] ?? []).map((set) => ({
      id: set.id,
      workout_exercise_id: set.workout_exercise_id,
      set_number: toNumber(set.set_number, 1),
      reps: toNumber(set.reps, 0),
      weight_kg: toNumber(set.weight_kg, 0),
      duration_minutes: toNumberOrNull(set.duration_minutes),
      speed: toNumberOrNull(set.speed),
      distance: toNumberOrNull(set.distance),
      incline: toNumberOrNull(set.incline),
      created_at: set.created_at,
      completed: false,
    })),
    last_session: [],
  }))

  return NextResponse.json({
    workout: {
      id: workout.id,
      user_id: workout.user_id,
      name: workout.name || "Workout",
      performed_at: workout.performed_at,
      duration_minutes: toNumberOrNull(workout.duration_minutes),
      notes: workout.notes,
    },
    exercises,
  })
}