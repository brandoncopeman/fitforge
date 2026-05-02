import sql from "@/lib/db"

export type PlanStatus = {
  weeklyTarget: number
  completedThisWeek: number
  remainingThisWeek: number
  status: "no_plan" | "on_track" | "behind" | "complete"
  title: string
  message: string
  emoji: string
  streakWeeks: number
}

export type WeeklyRecapSummary = {
  id: string
  title: string
  message: string
  emoji: string | null
  workouts: number
  volume: number
  averageDailyCalories: number
  steps: number
  goals: number
  weightChange: number | null
  created_at: string
} | null

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function getWorkoutWeekStreak(userId: string) {
  const rows = await sql`
    SELECT DISTINCT DATE_TRUNC('week', performed_at)::date AS week
    FROM workouts
    WHERE user_id = ${userId}
      AND duration_minutes IS NOT NULL
    ORDER BY week DESC
    LIMIT 52
  `

  const workoutWeeks = new Set(
    rows.map((row) => toDateKey(new Date(row.week)))
  )

  let streak = 0
  const cursor = getWeekStart(new Date())

  for (let i = 0; i < 52; i++) {
    const key = toDateKey(cursor)

    if (!workoutWeeks.has(key)) {
      break
    }

    streak++
    cursor.setDate(cursor.getDate() - 7)
  }

  return streak
}

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const [profileRows, planRows, completedRows] = await Promise.all([
    sql`
      SELECT weekly_workout_target
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM workout_templates
      WHERE user_id = ${userId}
        AND in_plan = true
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM workouts
      WHERE user_id = ${userId}
        AND duration_minutes IS NOT NULL
        AND performed_at >= DATE_TRUNC('week', now())
    `,
  ])

  const planCount = Number(planRows[0]?.count ?? 0)
  const profileTarget = Number(profileRows[0]?.weekly_workout_target ?? 0)
  const weeklyTarget = profileTarget > 0 ? profileTarget : planCount
  const completedThisWeek = Number(completedRows[0]?.count ?? 0)
  const remainingThisWeek = Math.max(0, weeklyTarget - completedThisWeek)
  const streakWeeks = await getWorkoutWeekStreak(userId)

  if (planCount === 0 || weeklyTarget === 0) {
    return {
      weeklyTarget: 0,
      completedThisWeek,
      remainingThisWeek: 0,
      status: "no_plan",
      title: "No workout plan yet",
      message: "Add templates to your plan to start tracking weekly progress.",
      emoji: "🧭",
      streakWeeks,
    }
  }

  if (completedThisWeek >= weeklyTarget) {
    return {
      weeklyTarget,
      completedThisWeek,
      remainingThisWeek: 0,
      status: "complete",
      title: "Plan complete this week",
      message: `You completed ${completedThisWeek}/${weeklyTarget} planned workouts. Strong week.`,
      emoji: "✅",
      streakWeeks,
    }
  }

  const now = new Date()
  const dayOfWeek = now.getDay()
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek
  const expectedByNow = Math.ceil((adjustedDay / 7) * weeklyTarget)

  if (completedThisWeek >= expectedByNow) {
    return {
      weeklyTarget,
      completedThisWeek,
      remainingThisWeek,
      status: "on_track",
      title: "You’re on track",
      message: `${completedThisWeek}/${weeklyTarget} workouts done this week. ${remainingThisWeek} to go.`,
      emoji: "🔥",
      streakWeeks,
    }
  }

  return {
    weeklyTarget,
    completedThisWeek,
    remainingThisWeek,
    status: "behind",
    title: "A little behind plan",
    message: `${completedThisWeek}/${weeklyTarget} workouts done this week. Aim for ${remainingThisWeek} more.`,
    emoji: "⏳",
    streakWeeks,
  }
}

export async function getLatestWeeklyRecap(userId: string): Promise<WeeklyRecapSummary> {
  const rows = await sql`
    SELECT id, title, message, emoji, metadata, created_at
    FROM progress_events
    WHERE user_id = ${userId}
      AND event_type = 'weekly_recap'
    ORDER BY created_at DESC
    LIMIT 1
  `

  const row = rows[0]

  if (!row) {
    return null
  }

  const metadata = row.metadata ?? {}

  return {
    id: row.id,
    title: row.title,
    message: row.message,
    emoji: row.emoji,
    workouts: Number(metadata.workouts ?? 0),
    volume: Number(metadata.volume ?? 0),
    averageDailyCalories: Number(metadata.averageDailyCalories ?? 0),
    steps: Number(metadata.steps ?? 0),
    goals: Number(metadata.goals ?? 0),
    weightChange:
      metadata.weightChange === null || metadata.weightChange === undefined
        ? null
        : Number(metadata.weightChange),
    created_at: String(row.created_at),
  }
}