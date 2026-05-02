import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { template_id } = await req.json()

  if (!template_id) {
    return NextResponse.json(
      { error: "template_id is required" },
      { status: 400 }
    )
  }

  const planTemplates = await sql`
    SELECT id, plan_order
    FROM workout_templates
    WHERE user_id = ${userId}
      AND in_plan = true
    ORDER BY plan_order ASC
  `

  const desiredIndex = planTemplates.findIndex(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (template: any) => String(template.id) === String(template_id)
  )

  if (desiredIndex === -1) {
    return NextResponse.json(
      { error: "Template is not in your active plan" },
      { status: 404 }
    )
  }

  const newLastPlanIndex =
    desiredIndex === 0 ? planTemplates.length - 1 : desiredIndex - 1

  await sql`
    UPDATE profiles
    SET last_plan_index = ${newLastPlanIndex}
    WHERE id = ${userId}
  `

  return NextResponse.json({
    success: true,
    next_template_id: template_id,
    last_plan_index: newLastPlanIndex,
  })
}