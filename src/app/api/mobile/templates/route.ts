import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type TemplateRow = {
  id: string
  user_id: string
  name: string
  in_plan: boolean
  plan_order: number | null
  created_at: string
  exercise_count: number | string
}

type TemplateExerciseRow = {
  id: string
  template_id: string
  exercise_name: string
  muscle_group: string | null
  order_index: number | null
  default_sets: number | null
  default_reps: number | null
  default_weight_kg: number | string | null
}

type LastSetRow = {
  exercise_name: string
  set_number: number
  weight_kg: number | string
  reps: number
}

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const templates = await sql`
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
    WHERE wt.user_id = ${userId}
    GROUP BY wt.id
    ORDER BY
      wt.in_plan DESC,
      wt.plan_order ASC NULLS LAST,
      wt.created_at DESC
  `

  const templateIds = (templates as TemplateRow[]).map((template) => template.id)

  const templateExercises =
    templateIds.length > 0
      ? await sql`
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
          WHERE template_id = ANY(${templateIds})
          ORDER BY order_index ASC
        `
      : []

  const exerciseNames = Array.from(
    new Set(
      (templateExercises as TemplateExerciseRow[]).map(
        (exercise) => exercise.exercise_name
      )
    )
  )

  const lastSets =
    exerciseNames.length > 0
      ? await sql`
          SELECT DISTINCT ON (we.exercise_name, es.set_number)
            we.exercise_name,
            es.set_number,
            es.weight_kg,
            es.reps
          FROM exercise_sets es
          JOIN workout_exercises we ON es.workout_exercise_id = we.id
          JOIN workouts w ON we.workout_id = w.id
          WHERE w.user_id = ${userId}
            AND we.exercise_name = ANY(${exerciseNames})
          ORDER BY we.exercise_name, es.set_number, w.performed_at DESC
        `
      : []

  const lastSetsByExercise = (lastSets as LastSetRow[]).reduce<
    Record<string, LastSetRow[]>
  >((map, set) => {
    if (!map[set.exercise_name]) {
      map[set.exercise_name] = []
    }

    map[set.exercise_name].push(set)
    return map
  }, {})

  const preparedTemplates = (templates as TemplateRow[]).map((template) => {
    const exercises = (templateExercises as TemplateExerciseRow[]).filter(
      (exercise) => exercise.template_id === template.id
    )

    return {
      ...template,
      exercise_count: Number(template.exercise_count ?? 0),
      exercises,
      lastSetsByExercise,
    }
  })

  const planTemplates = preparedTemplates.filter((template) => template.in_plan)

  const profileRows = await sql`
    SELECT last_plan_index
    FROM profiles
    WHERE id = ${userId}
    LIMIT 1
  `

  const lastPlanIndex = Number(profileRows[0]?.last_plan_index ?? -1)

  const nextPlanIndex =
    planTemplates.length > 0
      ? (lastPlanIndex + 1) % planTemplates.length
      : -1

  const nextTemplate =
    nextPlanIndex >= 0 ? planTemplates[nextPlanIndex] : null

  return NextResponse.json({
    templates: preparedTemplates,
    plan: {
      lastPlanIndex,
      nextPlanIndex,
      nextTemplate,
    },
  })
}