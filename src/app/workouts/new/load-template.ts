import sql from "@/lib/db"

type ExerciseRow = {
  exercise_name: string
  muscle_group: string
  order_index: number
  default_sets: number
  default_reps: number
  default_weight_kg: number
  template_name: string
}

type LastSetRow = {
  exercise_name: string
  set_number: number
  weight_kg: number
  reps: number
}

export async function loadTemplateData(templateId: string, userId: string) {
  const exercises = await sql`
    SELECT te.*, wt.name as template_name
    FROM template_exercises te
    JOIN workout_templates wt ON te.template_id = wt.id
    WHERE te.template_id = ${templateId}
      AND wt.user_id = ${userId}
    ORDER BY te.order_index ASC
  `

  if (exercises.length === 0) return null

  const templateName = (exercises[0] as ExerciseRow)?.template_name || "My Workout"
  const exerciseNames = exercises.map((e) => (e as ExerciseRow).exercise_name)

  const lastSets = await sql`
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

  const lastSetsByExercise: Record<string, { set_number: number; weight_kg: number; reps: number }[]> = {}
  lastSets.forEach((s) => {
    const row = s as LastSetRow
    if (!lastSetsByExercise[row.exercise_name]) lastSetsByExercise[row.exercise_name] = []
    lastSetsByExercise[row.exercise_name].push({
      set_number: row.set_number,
      weight_kg: row.weight_kg,
      reps: row.reps,
    })
  })

  return { templateName, exercises: exercises as ExerciseRow[], lastSetsByExercise }
}