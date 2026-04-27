import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const templates = await sql`
    SELECT 
      t.*,
      COUNT(te.id) as exercise_count
    FROM workout_templates t
    LEFT JOIN template_exercises te ON te.template_id = t.id
    WHERE t.user_id = ${userId}
    GROUP BY t.id
    ORDER BY t.plan_order ASC NULLS LAST, t.created_at DESC
  `
  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const body = await req.json()
  const { name } = body

  const rows = await sql`
    INSERT INTO workout_templates (user_id, name)
    VALUES (${userId}, ${name || "New Template"})
    RETURNING *
  `
  return NextResponse.json(rows[0])
}