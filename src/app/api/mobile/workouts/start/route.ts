import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type WorkoutExerciseRow = {
  id: string
  workout_id: string
  exercise_name: string
  exercise_external_id: string | null
  muscle_group: string | null
  order_index: number | null
}

type ExerciseSetRow = {
  id: string
  workout_exercise_id: string
  set_number: number
  reps: number
  weight_kg: number | string
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const requestedTemplateId = body.template_id as string | undefined

  const profileRows = await sql`
    SELECT last_plan_index
    FROM profiles
    WHERE id = ${userId}
    LIMIT 1
  `

  const planTemplates = await sql`
    SELECT id, name, plan_order
    FROM workout_templates
    WHERE user_id = ${userId}
      AND in_plan = true
    ORDER BY plan_order ASC
  `

  const lastPlanIndex = Number(profileRows[0]?.last_plan_index ?? -1)

  const nextPlanIndex =
    planTemplates.length > 0
      ? (lastPlanIndex + 1) % planTemplates.length
      : -1

  const queuedTemplate =
    nextPlanIndex >= 0 ? planTemplates[nextPlanIndex] : null

  const templateId = requestedTemplateId || queuedTemplate?.id

  if (!templateId) {
    return NextResponse.json(
      { error: "No workout template selected" },
      { status: 400 }
    )
  }

  const templateRows = await sql`
    SELECT *
    FROM workout_templates
    WHERE id = ${templateId}
      AND user_id = ${userId}
    LIMIT 1
  `

  const template = templateRows[0]

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    )
  }

  const templateExercises = await sql`
    SELECT
      id,
      exercise_name,
      muscle_group,
      order_index,
      default_sets,
      default_reps,
      default_weight_kg
    FROM template_exercises
    WHERE template_id = ${templateId}
    ORDER BY order_index ASC
  `

  const exerciseNames = templateExercises.map(
    (exercise) => exercise.exercise_name as string
  )

  const workoutRows = await sql`
    INSERT INTO workouts (user_id, name)
    VALUES (${userId}, ${template.name})
    RETURNING *
  `

  const workout = workoutRows[0]

  if (templateExercises.length === 0) {
    return NextResponse.json({
      workout,
      template,
      exercises: [],
      startedFromTemplateId: templateId,
      startedFromQueuedTemplate: !requestedTemplateId,
    })
  }

  await sql`
    INSERT INTO workout_exercises (
      workout_id,
      exercise_name,
      exercise_external_id,
      muscle_group,
      order_index
    )
    SELECT
      ${workout.id},
      te.exercise_name,
      NULL,
      te.muscle_group,
      COALESCE(te.order_index, 0)
    FROM template_exercises te
    WHERE te.template_id = ${templateId}
    ORDER BY te.order_index ASC
  `

  const workoutExercises = await sql`
    SELECT *
    FROM workout_exercises
    WHERE workout_id = ${workout.id}
    ORDER BY order_index ASC
  `

  await sql`
    WITH last_sets AS (
      SELECT DISTINCT ON (we.exercise_name, es.set_number)
        we.exercise_name,
        es.set_number,
        es.weight_kg,
        es.reps,
        w.performed_at
      FROM exercise_sets es
      JOIN workout_exercises we ON es.workout_exercise_id = we.id
      JOIN workouts w ON we.workout_id = w.id
      WHERE w.user_id = ${userId}
        AND w.id <> ${workout.id}
        AND we.exercise_name = ANY(${exerciseNames})
      ORDER BY we.exercise_name, es.set_number, w.performed_at DESC
    )
    INSERT INTO exercise_sets (
      workout_exercise_id,
      set_number,
      reps,
      weight_kg
    )
    SELECT
      we.id,
      generated.set_number,
      COALESCE(ls.reps, te.default_reps, 8),
      COALESCE(ls.weight_kg, te.default_weight_kg, 0)
    FROM template_exercises te
    JOIN workout_exercises we
      ON we.workout_id = ${workout.id}
      AND we.exercise_name = te.exercise_name
      AND COALESCE(we.order_index, 0) = COALESCE(te.order_index, 0)
    CROSS JOIN LATERAL generate_series(
      1,
      GREATEST(1, COALESCE(te.default_sets, 3))
    ) AS generated(set_number)
    LEFT JOIN last_sets ls
      ON ls.exercise_name = te.exercise_name
      AND ls.set_number = generated.set_number
    WHERE te.template_id = ${templateId}
    ORDER BY COALESCE(te.order_index, 0), generated.set_number
  `

  const exerciseIds = (workoutExercises as WorkoutExerciseRow[]).map(
    (exercise) => exercise.id
  )

  const sets =
    exerciseIds.length > 0
      ? await sql`
          SELECT *
          FROM exercise_sets
          WHERE workout_exercise_id = ANY(${exerciseIds})
          ORDER BY set_number ASC
        `
      : []

  const exercisesWithSets = (workoutExercises as WorkoutExerciseRow[]).map(
    (exercise) => ({
      ...exercise,
      sets: (sets as ExerciseSetRow[]).filter(
        (set) => set.workout_exercise_id === exercise.id
      ),
    })
  )

  return NextResponse.json({
    workout,
    template,
    exercises: exercisesWithSets,
    startedFromTemplateId: templateId,
    startedFromQueuedTemplate: !requestedTemplateId,
  })
}