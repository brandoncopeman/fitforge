import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-mobile-preview-secret",
}

function jsonWithCors(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

async function getRequestUserId(req: Request) {
  const { userId } = await auth()

  if (userId) {
    return userId
  }

  const { searchParams } = new URL(req.url)
  const devUserId = searchParams.get("devUserId")

  if (process.env.NODE_ENV !== "production" && devUserId) {
    return devUserId
  }

  const previewSecret = req.headers.get("x-mobile-preview-secret")
  const expectedSecret = process.env.MOBILE_PREVIEW_SECRET
  const previewUserId = process.env.MOBILE_PREVIEW_USER_ID

  if (expectedSecret && previewUserId && previewSecret === expectedSecret) {
    return previewUserId
  }

  return null
}

export async function GET(req: Request) {
  const userId = await getRequestUserId(req)

  if (!userId) {
    return jsonWithCors(
      { error: "Not logged in" },
      {
        status: 401,
      }
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

  return jsonWithCors({
    templates,
    plan: {
      lastPlanIndex,
      nextPlanIndex,
      nextTemplate,
    },
  })
}