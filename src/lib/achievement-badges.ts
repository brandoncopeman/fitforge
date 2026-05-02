import sql from "@/lib/db"
import { createProgressEvent } from "@/lib/progress-events"

type UnlockBadgeInput = {
  userId: string
  badgeKey: string
  title: string
  description: string
  emoji?: string
}

export type BadgeProgress = {
  badge_key: string
  title: string
  description: string
  emoji: string
  current: number
  target: number
}

async function getWorkoutWeekStreak(userId: string) {
  const rows = await sql`
    SELECT DISTINCT DATE_TRUNC('week', performed_at)::date AS week
    FROM workouts
    WHERE user_id = ${userId}
      AND duration_minutes IS NOT NULL
    ORDER BY week DESC
    LIMIT 52
  `

  const workoutWeeks = new Set(
    rows.map((row) => new Date(row.week).toISOString().slice(0, 10))
  )

  let streak = 0
  const cursor = new Date()
  const day = cursor.getDay()
  const diff = cursor.getDate() - day + (day === 0 ? -6 : 1)

  cursor.setDate(diff)
  cursor.setHours(0, 0, 0, 0)

  for (let i = 0; i < 52; i++) {
    const key = cursor.toISOString().slice(0, 10)

    if (!workoutWeeks.has(key)) {
      break
    }

    streak++
    cursor.setDate(cursor.getDate() - 7)
  }

  return streak
}

export async function unlockBadge(input: UnlockBadgeInput) {
  const {
    userId,
    badgeKey,
    title,
    description,
    emoji = "🏆",
  } = input

  const rows = await sql`
    INSERT INTO achievement_badges (
      user_id,
      badge_key,
      title,
      description,
      emoji
    )
    VALUES (
      ${userId},
      ${badgeKey},
      ${title},
      ${description},
      ${emoji}
    )
    ON CONFLICT (user_id, badge_key) DO NOTHING
    RETURNING *
  `

  const badge = rows[0] ?? null

  if (badge) {
    await createProgressEvent({
      userId,
      eventType: "badge_unlocked",
      title: "Badge unlocked",
      message: `${emoji} ${title}`,
      emoji: "🏆",
      source: "achievement_badges",
      sourceId: badge.id,
      dedupeKey: `badge_unlocked:${badgeKey}`,
      metadata: {
        badgeKey,
        badgeTitle: title,
        badgeEmoji: emoji,
      },
    })
  }

  return badge
}

export async function getUserBadges(userId: string) {
  return sql`
    SELECT id, badge_key, title, description, emoji, unlocked_at
    FROM achievement_badges
    WHERE user_id = ${userId}
    ORDER BY unlocked_at DESC
  `
}

export async function getBadgeProgress(userId: string): Promise<BadgeProgress[]> {
  const [
    workoutRows,
    stepGoalRows,
    goalCompletionRows,
    weightRows,
    progressStoryRows,
  ] = await Promise.all([
    sql`
      SELECT COUNT(DISTINCT w.id)::int AS count
      FROM workouts w
      JOIN workout_exercises we ON we.workout_id = w.id
      JOIN exercise_sets es ON es.workout_exercise_id = we.id
      WHERE w.user_id = ${userId}
        AND w.duration_minutes IS NOT NULL
        AND es.weight_kg > 0
        AND es.reps > 0
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM step_logs sl
      JOIN profiles p ON p.id = sl.user_id
      WHERE sl.user_id = ${userId}
        AND p.daily_step_target IS NOT NULL
        AND sl.steps >= p.daily_step_target
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM goal_completions
      WHERE user_id = ${userId}
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM weight_logs
      WHERE user_id = ${userId}
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM progress_events
      WHERE user_id = ${userId}
        AND event_type != 'badge_unlocked'
    `,
  ])

  const workoutCount = Number(workoutRows[0]?.count ?? 0)
  const stepGoalCount = Number(stepGoalRows[0]?.count ?? 0)
  const goalCompletionCount = Number(goalCompletionRows[0]?.count ?? 0)
  const weightLogCount = Number(weightRows[0]?.count ?? 0)
  const progressStoryCount = Number(progressStoryRows[0]?.count ?? 0)
  const workoutWeekStreak = await getWorkoutWeekStreak(userId)

  return [
    {
      badge_key: "first_workout",
      title: "First Workout",
      description: "Complete your first workout.",
      emoji: "💪",
      current: workoutCount,
      target: 1,
    },
    {
      badge_key: "three_workouts",
      title: "Getting Consistent",
      description: "Complete 3 workouts.",
      emoji: "🔥",
      current: workoutCount,
      target: 3,
    },
    {
      badge_key: "ten_workouts",
      title: "Ten Strong",
      description: "Complete 10 workouts.",
      emoji: "🏋️",
      current: workoutCount,
      target: 10,
    },
    {
      badge_key: "two_week_workout_streak",
      title: "Two-Week Streak",
      description: "Complete workouts two weeks in a row.",
      emoji: "🔥",
      current: workoutWeekStreak,
      target: 2,
    },
    {
      badge_key: "four_week_workout_streak",
      title: "Four-Week Streak",
      description: "Complete workouts four weeks in a row.",
      emoji: "🔥",
      current: workoutWeekStreak,
      target: 4,
    },
    {
      badge_key: "first_step_goal",
      title: "Step Crusher",
      description: "Hit your daily step goal.",
      emoji: "👟",
      current: stepGoalCount,
      target: 1,
    },
    {
      badge_key: "first_goal_completed",
      title: "Habit Started",
      description: "Complete your first daily goal.",
      emoji: "🎯",
      current: goalCompletionCount,
      target: 1,
    },
    {
      badge_key: "first_weight_logged",
      title: "Weight Logged",
      description: "Log your first weight entry.",
      emoji: "⚖️",
      current: weightLogCount,
      target: 1,
    },
    {
      badge_key: "first_progress_story",
      title: "First Progress Story",
      description: "Receive your first FitForge progress story.",
      emoji: "✨",
      current: progressStoryCount,
      target: 1,
    },
  ]
}