import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { getLatestWeeklyRecap, getPlanStatus } from "@/lib/plan-insights"

const QUOTES = [
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
  },
  {
    text: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius",
  },
  {
    text: "The pain you feel today will be the strength you feel tomorrow.",
    author: "Arnold Schwarzenegger",
  },
  {
    text: "Don't count the days, make the days count.",
    author: "Muhammad Ali",
  },
  {
    text: "The only bad workout is the one that didn't happen.",
    author: "Unknown",
  },
  {
    text: "Discipline is doing what needs to be done, even when you don't want to.",
    author: "Unknown",
  },
  {
    text: "Push yourself because no one else is going to do it for you.",
    author: "Unknown",
  },
  {
    text: "Motivation is what gets you started. Habit is what keeps you going.",
    author: "Jim Ryun",
  },
  {
    text: "Your biggest competition is the person you were yesterday.",
    author: "Unknown",
  },
]

type ProfileRow = {
  id: string
  display_name?: string | null
  weight_kg?: number | string | null
  goal?: string | null
  daily_calorie_target?: number | string | null
  daily_protein_target?: number | string | null
  daily_step_target?: number | string | null
  show_weight_on_home?: boolean | null
  home_section_order?: string[] | null
  last_plan_index?: number | null
}

type WorkoutTemplateRow = {
  id: string
  name: string
  exercise_count?: number | null
}

const DEFAULT_SECTION_ORDER = [
  "progress",
  "calories",
  "protein",
  "steps",
  "schedule",
  "workouts",
  "stats",
  "goals",
  "next",
]

function getDailyQuote() {
  const today = new Date()
  const dayOfYear = Math.floor(
    (Date.now() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  )

  return QUOTES[dayOfYear % QUOTES.length]
}

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json(
      { error: "Not logged in" },
      { status: 401 }
    )
  }

  const [
    profileRows,
    planTemplates,
    schedule,
    todayCalories,
    todayStepsRows,
    latestWeightRows,
    progressEvents,
    planStatus,
    weeklyRecap,
  ] = await Promise.all([
    sql`
      SELECT *
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `,

    sql`
      SELECT wt.*, COUNT(te.id)::int AS exercise_count
      FROM workout_templates wt
      LEFT JOIN template_exercises te ON te.template_id = wt.id
      WHERE wt.user_id = ${userId}
        AND wt.in_plan = true
      GROUP BY wt.id
      ORDER BY wt.plan_order ASC
    `,

    sql`
      SELECT gs.day_of_week, gs.template_id, wt.name AS template_name
      FROM gym_schedule gs
      LEFT JOIN workout_templates wt ON gs.template_id = wt.id
      WHERE gs.user_id = ${userId}
      ORDER BY gs.day_of_week ASC
    `,

    sql`
      SELECT COALESCE(SUM(calories), 0) AS total
      FROM food_entries
      WHERE user_id = ${userId}
        AND log_date = CURRENT_DATE
    `,

    sql`
      SELECT steps
      FROM step_logs
      WHERE user_id = ${userId}
        AND log_date = CURRENT_DATE
      LIMIT 1
    `,

    sql`
      SELECT weight_kg
      FROM weight_logs
      WHERE user_id = ${userId}
      ORDER BY log_date DESC
      LIMIT 1
    `,

    sql`
      SELECT id, event_type, title, message, emoji, created_at
      FROM progress_events
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 3
    `,

    getPlanStatus(userId),
    getLatestWeeklyRecap(userId),
  ])

  const profile = profileRows[0] as ProfileRow | undefined

  if (!profile || !profile.weight_kg || !profile.goal) {
    return NextResponse.json({
      onboardingRequired: true,
      profile: null,
    })
  }

  const typedPlanTemplates = planTemplates as WorkoutTemplateRow[]

  const lastPlanIndex = profile.last_plan_index ?? -1

  const nextPlanIndex =
    typedPlanTemplates.length > 0
      ? (lastPlanIndex + 1) % typedPlanTemplates.length
      : -1

  const nextTemplate =
    nextPlanIndex >= 0 ? typedPlanTemplates[nextPlanIndex] : null

  const caloriesConsumed = Math.round(Number(todayCalories[0]?.total ?? 0))
  const todaySteps = Number(todayStepsRows[0]?.steps ?? 0)
  const latestWeight = latestWeightRows[0]?.weight_kg
    ? Number(latestWeightRows[0].weight_kg)
    : null

  const todayDow = new Date().getDay()

  return NextResponse.json({
    onboardingRequired: false,

    profile: {
      id: profile.id,
      display_name: profile.display_name,
      daily_calorie_target: Number(profile.daily_calorie_target ?? 0),
      daily_protein_target: Number(profile.daily_protein_target ?? 0),
      daily_step_target: Number(profile.daily_step_target ?? 8000),
      show_weight_on_home: Boolean(profile.show_weight_on_home),
      daily_quote: getDailyQuote(),
    },

    dashboard: {
      caloriesConsumed,
      todaySteps,
      latestWeight,
      todayDow,
      sectionOrder: profile.home_section_order || DEFAULT_SECTION_ORDER,
    },

    plan: {
      templates: typedPlanTemplates,
      lastPlanIndex,
      nextPlanIndex,
      nextTemplate,
      status: planStatus,
    },

    schedule,

    progress: {
      events: progressEvents,
      weeklyRecap,
    },
  })
}