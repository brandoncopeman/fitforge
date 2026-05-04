import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type TemplateExerciseRow = {
  id: string
  exercise_name: string
  muscle_group: string | null
  order_index: number | null
  default_sets: number | null
  default_reps: number | null
  default_weight_kg: number | string | null
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json(
      { error: "Not logged in" },
      { status: 401 }
    )
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
    SELECT wt.*, COUNT(te.id)::int AS exercise_count
    FROM workout_templates wt
    LEFT JOIN template_exercises te ON te.template_id = wt.id
    WHERE wt.user_id = ${userId}
      AND wt.in_plan = true
    GROUP BY wt.id
    ORDER BY wt.plan_order ASC
  `

  if (planTemplates.length === 0 && !requestedTemplateId) {
    return NextResponse.json(
      { error: "No workout plan templates found" },
      { status: 400 }
    )
  }

  const lastPlanIndex = Number(profileRows[0]?.last_plan_index ?? -1)

  const nextPlanIndex =
    planTemplates.length > 0
      ? (lastPlanIndex + 1) % planTemplates.length
      : -1

  const queuedTemplate =
    requestedTemplateId
      ? null
      : nextPlanIndex >= 0
        ? planTemplates[nextPlanIndex]
        : null

  const templateId = requestedTemplateId || queuedTemplate?.id

  if (!templateId) {
    return NextResponse.json(
      { error: "No template selected" },
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

  const workoutRows = await sql`
    INSERT INTO workouts (user_id, name)
    VALUES (${userId}, ${template.name})
    RETURNING *
  `

  const workout = workoutRows[0]

  const createdExercises = []

  for (const templateExercise of templateExercises as TemplateExerciseRow[]) {
    const workoutExerciseRows = await sql`
      INSERT INTO workout_exercises (
        workout_id,
        exercise_name,
        exercise_external_id,
        muscle_group,
        order_index
      )
      VALUES (
        ${workout.id},
        ${templateExercise.exercise_name},
        ${null},
        ${templateExercise.muscle_group || null},
        ${templateExercise.order_index || 0}
      )
      RETURNING *
    `

    const workoutExercise = workoutExerciseRows[0]

    const defaultSetCount = Math.max(
      1,
      Number(templateExercise.default_sets ?? 3)
    )

    const defaultReps = Number(templateExercise.default_reps ?? 8)
    const defaultWeightKg = Number(templateExercise.default_weight_kg ?? 0)

    const createdSets = []

    for (let setNumber = 1; setNumber <= defaultSetCount; setNumber += 1) {
      const setRows = await sql`
        INSERT INTO exercise_sets (
          workout_exercise_id,
          set_number,
          reps,
          weight_kg
        )
        VALUES (
          ${workoutExercise.id},
          ${setNumber},
          ${defaultReps},
          ${defaultWeightKg}
        )
        RETURNING *
      `

      createdSets.push(setRows[0])
    }

    createdExercises.push({
      ...workoutExercise,
      sets: createdSets,
    })
  }

  return NextResponse.json({
    workout,
    template,
    exercises: createdExercises,
  })
}