import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json(
      { error: "Not logged in" },
      { status: 401 }
    )
  }

  const templates = await sql`
    SELECT
      wt.id,
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

  const profileRows = await sql`
    SELECT last_plan_index
    FROM profiles
    WHERE id = ${userId}
    LIMIT 1
  `

  const planTemplates = templates.filter((template) => template.in_plan)
  const lastPlanIndex = Number(profileRows[0]?.last_plan_index ?? -1)

  const nextPlanIndex =
    planTemplates.length > 0
      ? (lastPlanIndex + 1) % planTemplates.length
      : -1

  const nextTemplate =
    nextPlanIndex >= 0 ? planTemplates[nextPlanIndex] : null

  return NextResponse.json({
    templates,
    plan: {
      lastPlanIndex,
      nextPlanIndex,
      nextTemplate,
    },
  })
}