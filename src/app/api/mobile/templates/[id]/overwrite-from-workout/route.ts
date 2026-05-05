import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type IncomingExercise = {
  exercise_name: string
  muscle_group?: string | null
  order_index: number
  default_sets: number
  default_reps: number
  default_weight_kg: number
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { id: templateId } = await params
  const body = await req.json()
  const exercises = Array.isArray(body.exercises)
    ? (body.exercises as IncomingExercise[])
    : []

  const templateRows = await sql`
    SELECT *
    FROM workout_templates
    WHERE id = ${templateId}
      AND user_id = ${userId}
    LIMIT 1
  `

  if (!templateRows[0]) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  await sql`
    DELETE FROM template_exercises
    WHERE template_id = ${templateId}
  `

  for (const exercise of exercises) {
    const exerciseName = String(exercise.exercise_name || "").trim()

    if (!exerciseName) {
      continue
    }

    await sql`
      INSERT INTO template_exercises (
        template_id,
        exercise_name,
        muscle_group,
        order_index,
        default_sets,
        default_reps,
        default_weight_kg
      )
      VALUES (
        ${templateId},
        ${exerciseName},
        ${exercise.muscle_group || "other"},
        ${Number(exercise.order_index ?? 0)},
        ${Math.max(1, Number(exercise.default_sets ?? 1))},
        ${Math.max(0, Number(exercise.default_reps ?? 0))},
        ${Math.max(0, Number(exercise.default_weight_kg ?? 0))}
      )
    `
  }

  const updatedTemplateRows = await sql`
    SELECT
      wt.id,
      wt.user_id,
      wt.name,
      wt.in_plan,
      wt.plan_order,
      wt.created_at,
      COUNT(te.id)::int AS exercise_count
    FROM workout_templates wt
    LEFT JOIN template_exercises te ON te.template_id = wt.id
    WHERE wt.id = ${templateId}
      AND wt.user_id = ${userId}
    GROUP BY wt.id
    LIMIT 1
  `

  const templateExercises = await sql`
    SELECT
      id,
      template_id,
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

  return NextResponse.json({
    ...updatedTemplateRows[0],
    exercise_count: Number(updatedTemplateRows[0]?.exercise_count ?? 0),
    exercises: templateExercises,
    lastSetsByExercise: {},
  })
}