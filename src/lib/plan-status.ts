import sql from "@/lib/db"

export type PlanStatus = {
  planTemplatesCount: number
  completedThisWeek: number
  weeklyTarget: number
  nextTemplateName: string | null
  status: "no_plan" | "on_track" | "behind" | "ahead"
  title: string
  message: string
  emoji: string
}

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const [profileRows, planTemplateRows, completedRows] = await Promise.all([
    sql`
      SELECT last_plan_index, weekly_workout_target
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `,
    sql`
      SELECT id, name, plan_order
      FROM workout_templates
      WHERE user_id = ${userId}
        AND in_plan = true
      ORDER BY plan_order ASC
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM workouts
      WHERE user_id = ${userId}
        AND duration_minutes IS NOT NULL
        AND performed_at >= date_trunc('week', now())
    `,
  ])

  const profile = profileRows[0]
  const planTemplates = planTemplateRows
  const planTemplatesCount = planTemplates.length
  const completedThisWeek = Number(completedRows[0]?.count ?? 0)
  const weeklyTarget = Number(profile?.weekly_workout_target ?? planTemplatesCount ?? 0)

  if (planTemplatesCount === 0) {
    return {
      planTemplatesCount,
      completedThisWeek,
      weeklyTarget,
      nextTemplateName: null,
      status: "no_plan",
      title: "No workout plan yet",
      message: "Add templates to your plan to start tracking plan adherence.",
      emoji: "🧭",
    }
  }

  const lastPlanIndex = Number(profile?.last_plan_index ?? -1)
  const nextPlanIndex = (lastPlanIndex + 1) % planTemplatesCount
  const nextTemplate = planTemplates[nextPlanIndex]

  if (completedThisWeek >= weeklyTarget && weeklyTarget > 0) {
    return {
      planTemplatesCount,
      completedThisWeek,
      weeklyTarget,
      nextTemplateName: nextTemplate?.name ?? null,
      status: "ahead",
      title: "You’re ahead of plan",
      message: `${completedThisWeek}/${weeklyTarget} workouts completed this week. Strong momentum.`,
      emoji: "🚀",
    }
  }

  const now = new Date()
  const dayOfWeek = now.getDay()
  const expectedByNow = Math.max(1, Math.ceil(((dayOfWeek + 1) / 7) * weeklyTarget))

  if (completedThisWeek < expectedByNow) {
    return {
      planTemplatesCount,
      completedThisWeek,
      weeklyTarget,
      nextTemplateName: nextTemplate?.name ?? null,
      status: "behind",
      title: "Slightly behind plan",
      message: `${completedThisWeek}/${weeklyTarget} workouts completed. Next up: ${nextTemplate?.name ?? "your next workout"}.`,
      emoji: "⏳",
    }
  }

  return {
    planTemplatesCount,
    completedThisWeek,
    weeklyTarget,
    nextTemplateName: nextTemplate?.name ?? null,
    status: "on_track",
    title: "You’re on track",
    message: `${completedThisWeek}/${weeklyTarget} workouts completed this week. Next up: ${nextTemplate?.name ?? "your next workout"}.`,
    emoji: "✅",
  }
}