import sql from "@/lib/db"
import { createProgressEvent } from "@/lib/progress-events"
import { unlockBadge } from "@/lib/achievement-badges"

type WeightLog = {
  weight_kg: string | number
  log_date: string
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10
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
async function unlockFirstProgressStoryBadge(userId: string) {
  await unlockBadge({
    userId,
    badgeKey: "first_progress_story",
    title: "First Progress Story",
    description: "Received your first FitForge progress story.",
    emoji: "✨",
  })
}

export async function generateWeightProgressStory(userId: string) {
  const [profile, logs] = await Promise.all([
    sql`
      SELECT goal, goal_weight_kg
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `,
    sql`
      SELECT weight_kg, log_date
      FROM weight_logs
      WHERE user_id = ${userId}
      ORDER BY log_date DESC
      LIMIT 14
    `,
  ])

  const weightLogs = logs as WeightLog[]

  if (weightLogs.length < 7) return null

  const newestSeven = weightLogs
    .slice(0, 7)
    .map((log) => Number(log.weight_kg))
    .filter(Number.isFinite)

  const previousSeven = weightLogs
    .slice(7, 14)
    .map((log) => Number(log.weight_kg))
    .filter(Number.isFinite)

  if (newestSeven.length < 3 || previousSeven.length < 3) return null

  const currentAverage = average(newestSeven)
  const previousAverage = average(previousSeven)
  const weeklyChange = currentAverage - previousAverage
  const roundedChange = roundToOne(Math.abs(weeklyChange))

  const userGoal = profile[0]?.goal
  const goalWeight = profile[0]?.goal_weight_kg
    ? Number(profile[0].goal_weight_kg)
    : null

  const weekKey = new Date().toISOString().slice(0, 10)

  if (userGoal === "cut" && weeklyChange < -0.1) {
    let message = `Your 7-day average is down ${roundedChange}kg. Nice steady progress.`

    if (goalWeight) {
      const remaining = currentAverage - goalWeight
      const weeksLeft = Math.ceil(remaining / Math.abs(weeklyChange))

      if (weeksLeft > 0 && weeksLeft < 104) {
        message = `Your 7-day average is down ${roundedChange}kg. At this pace, you could reach your goal in about ${weeksLeft} weeks.`
      }
    }

    await unlockFirstProgressStoryBadge(userId)

    await unlockBadge({
      userId,
      badgeKey: "first_weight_trend",
      title: "Trend Watcher",
      description: "Generated your first weight trend story.",
      emoji: "📈",
    })

    await unlockBadge({
      userId,
      badgeKey: "first_weight_logged",
      title: "Weight Logged",
      description: "Logged your first weight entry.",
      emoji: "⚖️",
    })

    return createProgressEvent({
      userId,
      eventType: "weight_trend_cut",
      title: "You’re moving toward your goal",
      message,
      emoji: "📉",
      source: "weight_logs",
      dedupeKey: `weight_trend_cut:${weekKey}`,
      metadata: {
        weeklyChange,
        currentAverage,
        previousAverage,
      },
    })
  }

  if (userGoal === "bulk" && weeklyChange > 0.1) {
    await unlockFirstProgressStoryBadge(userId)

    await unlockBadge({
      userId,
      badgeKey: "first_weight_trend",
      title: "Trend Watcher",
      description: "Generated your first weight trend story.",
      emoji: "📈",
    })

    await unlockBadge({
      userId,
      badgeKey: "first_weight_logged",
      title: "Weight Logged",
      description: "Logged your first weight entry.",
      emoji: "⚖️",
    })

    return createProgressEvent({
      userId,
      eventType: "weight_trend_bulk",
      title: "Bulk progress detected",
      message: `Your 7-day average is up ${roundedChange}kg. Keep the momentum going.`,
      emoji: "📈",
      source: "weight_logs",
      dedupeKey: `weight_trend_bulk:${weekKey}`,
      metadata: {
        weeklyChange,
        currentAverage,
        previousAverage,
      },
    })
  }

  if (userGoal === "maintain" && Math.abs(weeklyChange) <= 0.2) {
    await unlockFirstProgressStoryBadge(userId)

    await unlockBadge({
      userId,
      badgeKey: "first_weight_trend",
      title: "Trend Watcher",
      description: "Generated your first weight trend story.",
      emoji: "📈",
    })

    await unlockBadge({
      userId,
      badgeKey: "first_weight_logged",
      title: "Weight Logged",
      description: "Logged your first weight entry.",
      emoji: "⚖️",
    })

    return createProgressEvent({
      userId,
      eventType: "weight_maintenance",
      title: "Weight is stable",
      message: "Your weight trend is holding steady. That’s exactly what maintenance should look like.",
      emoji: "⚖️",
      source: "weight_logs",
      dedupeKey: `weight_maintenance:${weekKey}`,
      metadata: {
        weeklyChange,
        currentAverage,
        previousAverage,
      },
    })
  }

  await unlockBadge({
    userId,
    badgeKey: "first_weight_logged",
    title: "Weight Logged",
    description: "Logged your first weight entry.",
    emoji: "⚖️",
  })

  return null
}

export async function generateStepProgressStory(userId: string, logDate: string) {
  const [profile, todayLog, recentLogs] = await Promise.all([
    sql`
      SELECT daily_step_target
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `,
    sql`
      SELECT steps
      FROM step_logs
      WHERE user_id = ${userId}
        AND log_date = ${logDate}
      LIMIT 1
    `,
    sql`
      SELECT steps, log_date
      FROM step_logs
      WHERE user_id = ${userId}
      ORDER BY log_date DESC
      LIMIT 7
    `,
  ])

  const target = Number(profile[0]?.daily_step_target ?? 0)
  const steps = Number(todayLog[0]?.steps ?? 0)

  if (!target || steps < target) return null

  const hitDays = recentLogs.filter((log) => Number(log.steps) >= target).length

  await unlockFirstProgressStoryBadge(userId)

  await unlockBadge({
    userId,
    badgeKey: "first_step_goal",
    title: "Step Crusher",
    description: "Hit your daily step goal.",
    emoji: "👟",
  })

  return createProgressEvent({
    userId,
    eventType: "step_goal_hit",
    title: "Step goal crushed",
    message:
      hitDays >= 3
        ? `You’ve hit your step goal ${hitDays} times recently. That consistency is adding up.`
        : `You hit your step goal today with ${steps.toLocaleString()} steps.`,
    emoji: "👟",
    source: "step_logs",
    dedupeKey: `step_goal_hit:${logDate}`,
    metadata: {
      steps,
      target,
      recentHitDays: hitDays,
    },
  })
}

export async function generateGoalProgressStory(userId: string, goalId: string) {
  const [goal, completions] = await Promise.all([
    sql`
      SELECT name, emoji
      FROM goals
      WHERE id = ${goalId}
        AND user_id = ${userId}
      LIMIT 1
    `,
    sql`
      SELECT completed_date
      FROM goal_completions
      WHERE user_id = ${userId}
        AND goal_id = ${goalId}
      ORDER BY completed_date DESC
      LIMIT 7
    `,
  ])

  if (!goal[0]) return null

  const completionCount = completions.length
  const latestDate = completions[0]?.completed_date?.toISOString?.().slice(0, 10)
    ?? String(completions[0]?.completed_date ?? new Date().toISOString().slice(0, 10))

  await unlockFirstProgressStoryBadge(userId)

  await unlockBadge({
    userId,
    badgeKey: "first_goal_completed",
    title: "Habit Started",
    description: "Completed your first daily goal.",
    emoji: "🎯",
  })

  return createProgressEvent({
    userId,
    eventType: "goal_completed",
    title: `${goal[0].emoji ?? "🎯"} Goal completed`,
    message:
      completionCount >= 3
        ? `You’ve completed ${goal[0].name} ${completionCount} times recently. That’s how habits are built.`
        : `You completed ${goal[0].name}. Nice work.`,
    emoji: goal[0].emoji ?? "🎯",
    source: "goal_completions",
    sourceId: goalId,
    dedupeKey: `goal_completed:${goalId}:${latestDate}`,
    metadata: {
      goalId,
      completionCount,
    },
  })
}

export async function generateWorkoutProgressStory(userId: string, workoutId: string) {
  const [workout, currentVolumeRows, previousVolumeRows, workoutCountRows] = await Promise.all([
    sql`
      SELECT name
      FROM workouts
      WHERE id = ${workoutId}
        AND user_id = ${userId}
      LIMIT 1
    `,
    sql`
      SELECT COALESCE(SUM(es.reps * es.weight_kg), 0) AS volume
      FROM workouts w
      JOIN workout_exercises we ON we.workout_id = w.id
      JOIN exercise_sets es ON es.workout_exercise_id = we.id
      WHERE w.id = ${workoutId}
        AND w.user_id = ${userId}
    `,
    sql`
      SELECT COALESCE(SUM(es.reps * es.weight_kg), 0) AS volume
      FROM workouts w
      JOIN workout_exercises we ON we.workout_id = w.id
      JOIN exercise_sets es ON es.workout_exercise_id = we.id
      WHERE w.user_id = ${userId}
        AND w.id != ${workoutId}
        AND w.performed_at >= now() - interval '14 days'
        AND w.performed_at < now() - interval '1 day'
    `,
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
  ])

  if (!workout[0]) return null

  const currentVolume = Number(currentVolumeRows[0]?.volume ?? 0)
  const previousVolume = Number(previousVolumeRows[0]?.volume ?? 0)
  const workoutCount = Number(workoutCountRows[0]?.count ?? 0)

  if (currentVolume <= 0) return null

  await unlockFirstProgressStoryBadge(userId)

  await unlockBadge({
    userId,
    badgeKey: "first_workout",
    title: "First Workout",
    description: "Completed your first workout in FitForge.",
    emoji: "💪",
  })

  if (workoutCount >= 3) {
    await unlockBadge({
      userId,
      badgeKey: "three_workouts",
      title: "Getting Consistent",
      description: "Completed 3 workouts.",
      emoji: "🔥",
    })
  }

  if (workoutCount >= 10) {
    await unlockBadge({
      userId,
      badgeKey: "ten_workouts",
      title: "Ten Strong",
      description: "Completed 10 workouts.",
      emoji: "🏋️",
    })
  }

  if (previousVolume > 0 && currentVolume > previousVolume) {
    const increase = Math.round(currentVolume - previousVolume)

    return createProgressEvent({
      userId,
      eventType: "workout_volume_increase",
      title: "Workout volume is up",
      message: `You lifted ${increase.toLocaleString()}kg more volume than your recent comparison. Strong session.`,
      emoji: "💪",
      source: "workouts",
      sourceId: workoutId,
      dedupeKey: `workout_volume_increase:${workoutId}`,
      metadata: {
        workoutId,
        currentVolume,
        previousVolume,
        increase,
      },
    })
  }

  return createProgressEvent({
    userId,
    eventType: "workout_completed",
    title: "Workout complete",
    message: `${workout[0].name ?? "Your workout"} is done. Another brick in the wall.`,
    emoji: "🔥",
    source: "workouts",
    sourceId: workoutId,
    dedupeKey: `workout_completed:${workoutId}`,
    metadata: {
      workoutId,
      currentVolume,
    },
  })
}

export async function generateWeeklyRecap(userId: string) {
  const weekRows = await sql`
    SELECT to_char(date_trunc('week', now()), 'IYYY-IW') AS week_key
  `

  const weekKey = weekRows[0]?.week_key ?? new Date().toISOString().slice(0, 10)

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
      ORDER BY log_date DESC
      LIMIT 14
    `,
  ])

  const workouts = Number(workoutRows[0]?.count ?? 0)
  const volume = Math.round(Number(volumeRows[0]?.volume ?? 0))
  const steps = Number(stepRows[0]?.steps ?? 0)
  const goals = Number(goalRows[0]?.count ?? 0)
  const workoutWeekStreak = await getWorkoutWeekStreak(userId)

  const weights = (weightRows as WeightLog[])
    .map((log) => Number(log.weight_kg))
    .filter(Number.isFinite)

  const latestWeight = weights[0]
  const oldestWeight = weights[weights.length - 1]
  const weightChange =
    latestWeight && oldestWeight ? roundToOne(latestWeight - oldestWeight) : null

  if (workouts === 0 && volume === 0 && steps === 0 && goals === 0) {
    return null
  }

  await unlockFirstProgressStoryBadge(userId)
if (workoutWeekStreak >= 2) {
  await unlockBadge({
    userId,
    badgeKey: "two_week_workout_streak",
    title: "Two-Week Streak",
    description: "Completed workouts two weeks in a row.",
    emoji: "🔥",
  })
}

if (workoutWeekStreak >= 4) {
  await unlockBadge({
    userId,
    badgeKey: "four_week_workout_streak",
    title: "Four-Week Streak",
    description: "Completed workouts four weeks in a row.",
    emoji: "🔥",
  })
}
const parts = [
  workouts > 0 ? `${workouts} workout${workouts === 1 ? "" : "s"}` : null,
  volume > 0 ? `${volume.toLocaleString()}kg lifted` : null,
  steps > 0 ? `${steps.toLocaleString()} steps` : null,
  goals > 0 ? `${goals} goal completion${goals === 1 ? "" : "s"}` : null,
  workoutWeekStreak > 1 ? `${workoutWeekStreak}-week workout streak` : null,
  weightChange !== null && weightChange !== 0
    ? `${weightChange > 0 ? "+" : ""}${weightChange}kg weight trend`
    : null,
].filter(Boolean)

  return createProgressEvent({
    userId,
    eventType: "weekly_recap",
    title: "Your week in FitForge",
    message: parts.join(" • "),
    emoji: "📅",
    source: "weekly_recap",
    dedupeKey: `weekly_recap:${weekKey}`,
    metadata: {
      weekKey,
      workouts,
      volume,
      steps,
      goals,
      weightChange,
      workoutWeekStreak,
    },
  })
}