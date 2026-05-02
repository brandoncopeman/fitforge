import sql from "@/lib/db"

export type WeeklyRecap = {
  workouts: number
  volume: number
  steps: number
  goals: number
  weightChange: number | null
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10
}

export async function getWeeklyRecap(userId: string): Promise<WeeklyRecap> {
  const [workoutRows, volumeRows, stepRows, goalRows, weightRows] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS count
      FROM workouts
      WHERE user_id = ${userId}
        AND duration_minutes IS NOT NULL
        AND performed_at >= date_trunc('week', now())
    `,
    sql`
      SELECT COALESCE(SUM(es.weight_kg * es.reps), 0) AS volume
      FROM workouts w
      JOIN workout_exercises we ON we.workout_id = w.id
      JOIN exercise_sets es ON es.workout_exercise_id = we.id
      WHERE w.user_id = ${userId}
        AND w.duration_minutes IS NOT NULL
        AND w.performed_at >= date_trunc('week', now())
    `,
    sql`
      SELECT COALESCE(SUM(steps), 0)::int AS steps
      FROM step_logs
      WHERE user_id = ${userId}
        AND log_date >= date_trunc('week', now())::date
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM goal_completions
      WHERE user_id = ${userId}
        AND completed_date >= date_trunc('week', now())::date
    `,
    sql`
      SELECT weight_kg, log_date
      FROM weight_logs
      WHERE user_id = ${userId}
        AND log_date >= date_trunc('week', now())::date
      ORDER BY log_date ASC
    `,
  ])

  const weights = weightRows.map((log) => Number(log.weight_kg)).filter(Number.isFinite)

  const weightChange =
    weights.length >= 2
      ? roundToOne(weights[weights.length - 1] - weights[0])
      : null

  return {
    workouts: Number(workoutRows[0]?.count ?? 0),
    volume: Math.round(Number(volumeRows[0]?.volume ?? 0)),
    steps: Number(stepRows[0]?.steps ?? 0),
    goals: Number(goalRows[0]?.count ?? 0),
    weightChange,
  }
}