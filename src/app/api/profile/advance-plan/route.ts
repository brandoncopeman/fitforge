import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { template_id } = await req.json()

  // Find the plan index of this template
  const planTemplates = await sql`
    SELECT id, plan_order FROM workout_templates
    WHERE user_id = ${userId} AND in_plan = true
    ORDER BY plan_order ASC
  `

  const idx = (planTemplates as { id: string }[]).findIndex(t => t.id === template_id)
      if (idx === -1) return NextResponse.json({ success: false })

  // Advance to next index, cycling back to 0
  const nextIndex = idx

  await sql`
    UPDATE profiles SET last_plan_index = ${nextIndex}
    WHERE id = ${userId}
  `

  return NextResponse.json({ success: true, nextIndex })
}